// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-battle-ai.mjs
import assert from 'node:assert/strict';
import mapsData from '../src/data/battleMaps.json' with { type: 'json' };

const rules = await import('../src/battle/battleRules.ts');
const engine = await import('../src/battle/battleEngine.ts');
const ai = await import('../src/battle/battleAi.ts');
const hex = await import('../src/battle/hex.ts');
const simulator = await import('./simulate-battle-hex.mjs');

const at = (col, row) => hex.offsetToAxial(col, row);
const openSea = mapsData.maps.find((map) => map.id === 'open_sea');

const makeUnit = (overrides = {}) => ({
  id: 'e0', side: 'enemy', shipTypeId: 'ai_test', shipSize: 'medium', flagship: false,
  hex: at(5, 3), facing: 1, hull: 100, hullMax: 100,
  cannons: 5, cannonTypeId: 'standard', cannonPower: 1, gunnerMod: 1, armorMultiplier: 1,
  crew: 30, boardingBonus: 0, crewLossMultiplier: 1,
  movePoints: 3, moveSpent: 0, moved: false, acted: false, repaired: false, status: 'active',
  ...overrides,
  hex: { ...(overrides.hex ?? at(5, 3)) },
});

const makePlayer = (overrides = {}) => makeUnit({
  id: 'p0', side: 'player', flagship: true, hex: at(3, 3), facing: 0,
  ...overrides,
});

const makeEnemyState = (units) => ({
  ...engine.createBattleState({ seed: 2468, mapId: 'open_sea', units }),
  activeSide: 'enemy',
  phase: 'enemy_turn',
});

let cases = 0;
const test = (name, run) => {
  run();
  cases += 1;
  console.log(`✓ ${name}`);
};

test('AI 優先砲擊可擊沉的玩家旗艦', () => {
  const attacker = makeUnit({ id: 'e0', cannons: 8 });
  const flagship = makePlayer({ id: 'p0', hull: 1, hullMax: 100 });
  const escort = makePlayer({ id: 'p1', flagship: false, hex: at(5, 4), hull: 1, hullMax: 100 });
  const state = makeEnemyState([attacker, flagship, escort]);
  assert.equal(rules.validateCannonAttack(openSea, attacker, flagship).ok, true);
  const decision = ai.chooseBattleAiDecision(state, openSea, 'enemy');
  assert.deepEqual(decision, {
    command: { type: 'cannon', attackerId: 'e0', targetId: 'p0' },
    reason: 'sink_flagship',
  });
});

test('接舷勝率達 65% 時優先於一般砲擊', () => {
  const attacker = makeUnit({ id: 'e0', hex: at(4, 3), crew: 100, boardingBonus: 50, facing: 0 });
  const target = makePlayer({ id: 'p0', hex: at(3, 3), crew: 5, hull: 100 });
  const state = makeEnemyState([attacker, target]);
  assert.ok(ai.estimateBoardingWinChance(attacker, target) >= 0.65);
  const decision = ai.chooseBattleAiDecision(state, openSea, 'enemy');
  assert.equal(decision.reason, 'board_advantage');
  assert.deepEqual(decision.command, { type: 'board', attackerId: 'e0', targetId: 'p0' });
});

test('接舷勝率積分在強弱與五五波案例維持固定', () => {
  const balancedEnemy = makeUnit({ crew: 100, boardingBonus: 25 });
  const balancedPlayer = makePlayer({ crew: 100, boardingBonus: 0 });
  assert.ok(Math.abs(ai.estimateBoardingWinChance(balancedEnemy, balancedPlayer) - 0.5) < 1e-10);
  assert.equal(ai.estimateBoardingWinChance(makeUnit({ crew: 200 }), makePlayer({ crew: 1 })), 1);
  assert.equal(ai.estimateBoardingWinChance(makeUnit({ crew: 1 }), makePlayer({ crew: 200 })), 0);
});

test('一般砲擊選預估傷害最高的目標', () => {
  const attacker = makeUnit({ id: 'e0', facing: 0 });
  const flagship = makePlayer({ id: 'p0', hex: at(5, 4), hull: 100, armorMultiplier: 1 });
  const vulnerable = makePlayer({ id: 'p1', flagship: false, hex: at(4, 4), hull: 100, armorMultiplier: 1.5 });
  assert.equal(rules.validateCannonAttack(openSea, attacker, flagship).ok, true);
  assert.equal(rules.validateCannonAttack(openSea, attacker, vulnerable).ok, true);
  const decision = ai.chooseBattleAiDecision(makeEnemyState([attacker, flagship, vulnerable]), openSea, 'enemy');
  assert.equal(decision.reason, 'best_cannon');
  assert.equal(decision.command.targetId, 'p1');
});

test('砲擊同分固定選旗艦、低耐久、id 字典序', () => {
  const attacker = makeUnit({ id: 'e0', facing: 0 });
  const flagship = makePlayer({ id: 'p9', hex: at(5, 4), hull: 100 });
  const escort = makePlayer({ id: 'p0', flagship: false, hex: at(4, 4), hull: 20 });
  const decision = ai.chooseBattleAiDecision(makeEnemyState([attacker, flagship, escort]), openSea, 'enemy');
  assert.equal(decision.reason, 'best_cannon');
  assert.equal(decision.command.targetId, 'p9');
});

test('耐久低於 25% 且在己方邊界時撤退', () => {
  const attacker = makeUnit({ id: 'e0', hex: at(10, 3), hull: 24, hullMax: 100 });
  const target = makePlayer({ id: 'p0', hex: at(0, 3) });
  const decision = ai.chooseBattleAiDecision(makeEnemyState([attacker, target]), openSea, 'enemy');
  assert.deepEqual(decision, { command: { type: 'retreat', unitId: 'e0' }, reason: 'retreat' });
});

test('無直接攻擊時產生合法路徑並接近最近目標', () => {
  const attacker = makeUnit({ id: 'e0', hex: at(10, 3), facing: 3 });
  const target = makePlayer({ id: 'p0', hex: at(5, 3) });
  const state = makeEnemyState([attacker, target]);
  const beforeDistance = hex.hexDistance(attacker.hex, target.hex);
  const decision = ai.chooseBattleAiDecision(state, openSea, 'enemy');
  assert.equal(decision.reason, 'move_to_attack');
  assert.equal(decision.command.type, 'move');
  const result = engine.applyCommand(state, openSea, decision.command, rules.createSeededRng(1));
  assert.equal(result.ok, true);
  const moved = result.state.units.find((unit) => unit.id === 'e0');
  assert.ok(hex.hexDistance(moved.hex, target.hex) < beforeDistance);
});

test('完全無路且無轉向點數時等待，不會卡死', () => {
  const attacker = makeUnit({ id: 'e0', hex: at(0, 0), movePoints: 1, moveSpent: 1 });
  const target = makePlayer({ id: 'p0', hex: at(10, 6) });
  const decision = ai.chooseBattleAiDecision(makeEnemyState([attacker, target]), openSea, 'enemy');
  assert.deepEqual(decision, { command: { type: 'wait', unitId: 'e0' }, reason: 'wait' });
});

test('120 場固定 seed 模擬可重播且全部合法結算', () => {
  const first = simulator.simulateBatch(120);
  const second = simulator.simulateBatch(120);
  assert.deepEqual(second, first, '相同 seed 與地圖必須完整重播一致');
  assert.ok(first.every((result) => result.round <= 12));
  assert.ok(first.every((result) => result.winner !== null));
  assert.ok(first.every((result) => result.commandCount < 800));
});

console.log(`\n✅ P6 敵方 AI 固定案例 ${cases} 組全部通過（含 120 場雙次重播）`);
