// Usage: node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-battle-p7.mjs
import assert from 'node:assert/strict';
const stateModule = await import('../src/state.ts');
const adapter = await import('../src/battle/battleAdapter.ts');
const engine = await import('../src/battle/battleEngine.ts');

let cases = 0;
const test = (name, run) => { run(); cases += 1; console.log('ok ' + name); };
const fresh = (count = 1) => {
  const state = stateModule.newGame('lin');
  const types = ['junk_large', 'shuinsen', 'caravel', 'fuchuan'];
  state.escorts = types.slice(0, count - 1).map((id, index) => stateModule.newPlayerShip(id, { x: state.ship.x + index + 1, y: state.ship.y }));
  state.crew = 140;
  return state;
};
const sideCount = (launch, side) => launch.units.filter((unit) => unit.side === side).length;

test('player owned fleet maps one-to-one from one through five ships', () => {
  for (let count = 1; count <= 5; count += 1) {
    const launch = adapter.createHexBattleLaunch(fresh(count), { kind: 'pirate', tier: 1 }, 100 + count);
    assert.equal(sideCount(launch, 'player'), count);
    assert.equal(Object.keys(launch.playerShipIndexes).length, count);
  }
});

test('tier counts stay inside approved ranges and exercise both weighted outcomes', () => {
  const expected = { 1: new Set([1, 2]), 2: new Set([2, 3]), 3: new Set([3, 4]) };
  for (const tier of [1, 2, 3]) {
    const seen = new Set();
    for (let seed = 1; seed <= 300; seed += 1) {
      const launch = adapter.createHexBattleLaunch(fresh(), { kind: 'pirate', tier }, seed);
      const count = sideCount(launch, 'enemy');
      assert.ok(expected[tier].has(count));
      seen.add(count);
    }
    assert.deepEqual(seen, expected[tier]);
  }
});

test('一般海盜強度不會只因航海天數把新手推進礁岩高階戰', () => {
  const novice = fresh(1);
  novice.day = 500;
  novice.captain.level = 1;
  assert.equal(stateModule.pirateEncounterTier(novice), 1);
  const noviceLaunch = adapter.createHexBattleLaunch(novice, { kind: 'pirate', tier: stateModule.pirateEncounterTier(novice) }, 9);
  assert.equal(noviceLaunch.mapId, 'open_sea');
  assert.ok(sideCount(noviceLaunch, 'enemy') <= 2);

  const veteran = fresh(3);
  veteran.day = 500;
  veteran.captain.level = 20;
  assert.equal(stateModule.pirateEncounterTier(veteran), 3);
  assert.equal(adapter.createHexBattleLaunch(veteran, { kind: 'pirate', tier: 3 }, 9).mapId, 'reef_passage');
});

test('任務資訊顯示接取港，入港休整會清除海上負面狀態', () => {
  const state = fresh(1);
  state.statuses = [{ id: 'rats', days: 3 }, { id: 'storm', days: 2 }, { id: 'homesick', days: 4 }];
  stateModule.clearSeaStatusesOnPort(state);
  assert.deepEqual(state.statuses, []);
  const text = stateModule.questProgressText(state, {
    type: 'combat', title: '測試委託', originPortId: 'yuegang', targetX: 0, targetY: 0,
    deadlineDay: 99, reward: 100, enemyTier: 1, completed: false, codexIds: [],
  });
  assert.match(text, /接取港口：【月港】/);
  assert.match(text, /回到【月港】/);
});

test('named large battle is fixed and temporary ally never replaces owned ships', () => {
  const oneShip = adapter.createHexBattleLaunch(fresh(1), { kind: 'story', tier: 3, duelName: '\u6e05\u65b9\u6504\u622a\u8239' }, 77);
  assert.equal(oneShip.encounterId, 'story_huflag');
  assert.equal(sideCount(oneShip, 'enemy'), 4);
  assert.equal(sideCount(oneShip, 'player'), 2);
  assert.equal(oneShip.units.filter((unit) => unit.id.startsWith('a')).length, 1);
  const fullFleet = adapter.createHexBattleLaunch(fresh(5), { kind: 'story', tier: 3, duelName: '\u6e05\u65b9\u6504\u622a\u8239' }, 77);
  assert.equal(sideCount(fullFleet, 'player'), 5);
  assert.equal(fullFleet.units.filter((unit) => unit.id.startsWith('a')).length, 0);
});

test('victory writes owned hull crew reward and quest once without persisting ally', () => {
  const state = fresh(1);
  state.quest = { type: 'combat', title: 'test', originPortId: 'tayouan', targetX: 0, targetY: 0, deadlineDay: 99, reward: 1, enemyTier: 1, completed: false, codexIds: [] };
  const beforeGold = state.gold;
  const launch = adapter.createHexBattleLaunch(state, { kind: 'quest', tier: 1, questCombat: true }, 20);
  const battle = engine.createBattleState({ seed: launch.seed, mapId: launch.mapId, units: launch.units });
  battle.winner = 'player';
  battle.units.find((unit) => unit.id === 'p0').hull = 55;
  const escortCount = state.escorts.length;
  const result = adapter.settleHexBattle(state, launch, battle);
  assert.equal(result.defeated, false);
  assert.equal(state.quest.completed, true);
  assert.equal(state.ship.hull, 55);
  assert.equal(state.escorts.length, escortCount);
  assert.equal(state.gold, beforeGold + launch.loot);
});

test('defeat sends fleet to a port and keeps v20+ save structure readable', () => {
  const state = fresh(3);
  assert.ok(state.version >= 20);
  const launch = adapter.createHexBattleLaunch(state, { kind: 'pirate', tier: 3 }, 33);
  const battle = engine.createBattleState({ seed: launch.seed, mapId: launch.mapId, units: launch.units });
  battle.winner = 'enemy';
  const result = adapter.settleHexBattle(state, launch, battle);
  assert.equal(result.defeated, true);
  assert.ok(state.ship.hull > 0);
  assert.ok(stateModule.PORTS.some((port) => port.x === state.ship.x && port.y + 26 === state.ship.y));
});

console.log(`P7 adapter ${cases} cases passed`);
