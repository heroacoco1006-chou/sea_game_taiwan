const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};

const m = await import('../src/state.ts');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const point = (id) => m.EXPLORATION_POINTS.find((entry) => entry.id === id);
const event = (id) => m.EXPLORATION_EVENTS.find((entry) => entry.id === id);
const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

// v21 → v22：舊欄位保留，新欄位補齊，已完成主要發現不補發聲望。
const old = m.newGame('lin');
old.version = 21;
old.story.codex.push(...point('exp_taroko').mainDiscoveries.map((ref) => ref.id));
const oldAdventureRep = old.reputation.adventure;
delete old.exploration.missStreaks;
delete old.exploration.noEventStreaks;
delete old.exploration.completedMainPoints;
delete old.exploration.repeatRepDayByPoint;
store.set('seagame_save_slot0', JSON.stringify(old));
const migrated = m.loadGame(0);
assert(migrated?.version === 22, 'v21 save did not migrate to v22');
assert(migrated.exploration.completedMainPoints.includes('exp_taroko'), 'completed main point was not backfilled');
assert(migrated.reputation.adventure === oldAdventureRep, 'migration must not grant completion reputation');

// 事件保底按地點分開：第一次空白後，同地點第二次強制有事件；別的地點不受影響。
const guarantee = m.newGame('lin');
const taroko = point('exp_taroko');
const alishan = point('exp_alishan');
assert(m.rollExplorationEvent(guarantee, taroko, () => 0.99) === null, 'first high roll should produce no event');
assert(m.rollExplorationEvent(guarantee, taroko, () => 0.99) !== null, 'second attempt at same point must be guaranteed');
assert(m.rollExplorationEvent(guarantee, alishan, () => 0.99) === null, 'guarantee must not leak to another point');

// 嚮導降低迷路權重：相同 roll 在無嚮導時抽到 lost，有嚮導時跨到下一事件。
const guidePoint = {
  ...taroko,
  difficulty: 2,
  terrainTags: ['mountain', 'forest'],
  events: [{ id: 'lost', weight: 1 }, { id: 'wildlife', weight: 1 }],
};
const noGuide = m.newGame('lin');
const withGuide = m.newGame('lin');
withGuide.mates.push({ id: 'test_guide', role: 'guide' });
assert(m.rollExplorationEvent(noGuide, guidePoint, sequence(0, 0.4))?.id === 'lost', 'baseline event weight selection failed');
assert(m.rollExplorationEvent(withGuide, guidePoint, sequence(0, 0.4))?.id === 'wildlife', 'guide did not reduce lost weight');

// 固定亂數抽主要池最後一項，證明不是 JSON 第一項；已解鎖項目不會再抽。
const randomMain = m.newGame('lin');
const mainRefs = taroko.mainDiscoveries;
const mainRoll = m.rollExplorationDiscovery(randomMain, taroko, 1, 0, sequence(0.99, 0, 0.99));
assert(mainRoll.kind === 'main' && mainRoll.discoveryId === mainRefs.at(-1).id, 'main discovery is not weighted/random');
m.applyExplorationDiscoveryResult(randomMain, taroko, mainRoll);
const nextRoll = m.rollExplorationDiscovery(randomMain, taroko, 1, 0, sequence(0.99, 0, 0.99));
assert(nextRoll.discoveryId !== mainRoll.discoveryId, 'unlocked discovery was rolled again');

// 稀有優先於主要，一次只回一個唯一發現；稀有 +8。
const rareState = m.newGame('lin');
const rareBefore = rareState.reputation.adventure;
const rareRoll = m.rollExplorationDiscovery(rareState, taroko, 1, 0, sequence(0, 0));
assert(rareRoll.kind === 'rare' && Boolean(rareRoll.discoveryId), 'rare roll should take priority');
const rareReward = m.applyExplorationDiscoveryResult(rareState, taroko, rareRoll);
assert(rareReward.unlockedIds.length === 1, 'one expedition may unlock only one unique discovery');
assert(rareState.reputation.adventure === rareBefore + 8, 'rare discovery must grant +8 adventure rep');

// 主要成功重設 miss streak；完成最後主要項目另給 +6，且不可重複。
const completion = m.newGame('lin');
completion.story.codex.push(...mainRefs.slice(0, -1).map((ref) => ref.id));
completion.exploration.missStreaks[taroko.id] = 4;
const completionBefore = completion.reputation.adventure;
const completionRoll = { kind: 'main', discoveryId: mainRefs.at(-1).id };
const completionReward = m.applyExplorationDiscoveryResult(completion, taroko, completionRoll);
assert(completion.exploration.missStreaks[taroko.id] === 0, 'main success must reset miss streak');
assert(completion.reputation.adventure === completionBefore + 9, 'last main discovery must grant +3 and completion +6');
assert(completionReward.adventureRepGained === 9, 'reported reputation gain is wrong');
m.applyExplorationDiscoveryResult(completion, taroko, completionRoll);
assert(completion.reputation.adventure === completionBefore + 9, 'completion rewards were granted twice');

// miss streak 上限為 +0.20。
const miss = m.newGame('lin');
const baseChance = m.explorationFindChance(miss, taroko);
miss.exploration.missStreaks[taroko.id] = 99;
const cappedChance = m.explorationFindChance(miss, taroko);
assert(Math.abs((cappedChance - baseChance) - 0.2) < 1e-9 || cappedChance === 0.92, 'miss streak bonus is not capped at +0.20');

// 重複成果同地點同日最多 +1，但完成全部唯一發現後仍能取得成果。
const repeat = m.newGame('lin');
repeat.story.codex.push(...[...taroko.mainDiscoveries, ...taroko.rareDiscoveries].map((ref) => ref.id));
const repeatRoll = m.rollExplorationDiscovery(repeat, taroko, 0, 0, () => 0);
assert(repeatRoll.kind === 'repeat' && Boolean(repeatRoll.repeatReward), 'completed point must still yield repeat reward');
const repeatBefore = repeat.reputation.adventure;
m.applyExplorationDiscoveryResult(repeat, taroko, repeatRoll);
m.applyExplorationDiscoveryResult(repeat, taroko, repeatRoll);
assert(repeat.reputation.adventure === repeatBefore + 1, 'repeat reward rep must be limited to +1 per point per day');

// 水手保護：低於 8 人不減員、最低不低於 5；醫師有機會免除 -1。
const crewSafe = m.newGame('lin');
crewSafe.crew = 7;
const fatigueBefore = crewSafe.fatigue;
const protectedEffect = m.applyExplorationEventEffects(crewSafe, event('storm_landslide'), { crew: -1 }, () => 0);
assert(crewSafe.crew === 7 && crewSafe.fatigue === fatigueBefore + 5, 'low-crew protection failed');
assert(protectedEffect.crewDelta === 0, 'protected crew delta must be zero');
const medic = m.newGame('lin');
medic.crew = 20;
medic.mates.push({ id: 'test_medic', role: 'surgeon' });
m.applyExplorationEventEffects(medic, event('storm_landslide'), { crew: -1 }, () => 0);
assert(medic.crew === 20, 'surgeon 50% prevention path failed');

// 10,000 次獨立首擲約 70%；連續序列不得兩次空白。
let seed = 123456789;
const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
let triggered = 0;
for (let i = 0; i < 10000; i++) {
  const state = m.newGame('lin');
  if (m.rollExplorationEvent(state, taroko, rng)) triggered++;
}
const rate = triggered / 10000;
assert(rate >= 0.68 && rate <= 0.72, `raw event rate ${rate} is outside 70% ±2%`);
const sequenceState = m.newGame('lin');
let previousEmpty = false;
for (let i = 0; i < 1000; i++) {
  const empty = m.rollExplorationEvent(sequenceState, taroko, rng) === null;
  assert(!(previousEmpty && empty), 'event guarantee allowed two consecutive empty attempts');
  previousEmpty = empty;
}

console.log(`Exploration v22 tests passed. Raw event rate: ${(rate * 100).toFixed(2)}%.`);
