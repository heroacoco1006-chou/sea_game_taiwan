// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-battle-auto.mjs
import assert from 'node:assert/strict';
import mapsData from '../src/data/battleMaps.json' with { type: 'json' };

const rules = await import('../src/battle/battleRules.ts');
const engine = await import('../src/battle/battleEngine.ts');
const ai = await import('../src/battle/battleAi.ts');
const simulator = await import('./simulate-battle-hex.mjs');

const openSea = mapsData.maps.find((map) => map.id === 'open_sea');
const playerDeployments = rules.deploymentHexes(openSea, 'player');
const enemyDeployments = rules.deploymentHexes(openSea, 'enemy');

const makeUnit = (overrides = {}) => ({
  id: 'p0', side: 'player', shipTypeId: 'auto_test', shipSize: 'medium', flagship: false,
  hex: { ...playerDeployments[0] }, facing: 0, hull: 100, hullMax: 100,
  cannons: 0, cannonTypeId: 'standard', cannonPower: 1, gunnerMod: 1, armorMultiplier: 1,
  crew: 0, boardingBonus: 0, crewLossMultiplier: 1,
  movePoints: 3, moveSpent: 0, moved: false, acted: false, repaired: false, status: 'active',
  ...overrides,
  hex: { ...(overrides.hex ?? playerDeployments[0]) },
});

let cases = 0;
const test = (name, run) => {
  run();
  cases += 1;
  console.log('✓ ' + name);
};

test('sidePower 依核准公式計算並排除離場船隻', () => {
  const flagship = makeUnit({ id: 'p0', flagship: true, hull: 100, cannons: 5, crew: 20 });
  const escort = makeUnit({
    id: 'p1', hex: playerDeployments[1], hull: 80, cannons: 2, cannonTypeId: 'ct_hongyi', crew: 10,
  });
  const expected = (100 + 5 * 1 * 6 + 20 * 0.5) * 1.2
    + (80 + 2 * 1.3 * 6 + 10 * 0.5);
  assert.ok(Math.abs(rules.sidePower([flagship, escort], 'player') - expected) < 1e-10);
  assert.equal(rules.sidePower([flagship, { ...escort, status: 'sunk' }], 'player'), 168);
});

test('自動戰鬥 1.5 倍門檻兩側與無敵軍案例固定', () => {
  const enemy = makeUnit({ id: 'e0', side: 'enemy', hex: enemyDeployments[0], hull: 100 });
  const exact = rules.assessAutoBattle([makeUnit({ hull: 150 }), enemy]);
  assert.equal(exact.enabled, true);
  assert.equal(exact.advantageRatio, 1.5);
  assert.equal(exact.requiredRatio, 1.5);

  const below = rules.assessAutoBattle([makeUnit({ hull: 149 }), enemy]);
  assert.equal(below.enabled, false);
  assert.equal(below.reason, 'insufficient_advantage');

  const noEnemy = rules.assessAutoBattle([makeUnit({ hull: 150 }), { ...enemy, status: 'sunk' }]);
  assert.equal(noEnemy.enabled, false);
  assert.equal(noEnemy.reason, 'no_active_enemy');
});

test('自動戰鬥啟動後可停止 AI 迴圈並改送手動指令', () => {
  const player = makeUnit({
    id: 'p0', flagship: true, hull: 180, hullMax: 180, cannons: 8, crew: 60,
  });
  const enemy = makeUnit({
    id: 'e0', side: 'enemy', flagship: true, hex: enemyDeployments[0], facing: 3,
    hull: 70, hullMax: 70, cannons: 1, crew: 10,
  });
  let state = engine.createBattleState({ seed: 7788, mapId: 'open_sea', units: [player, enemy] });
  assert.equal(rules.assessAutoBattle(state.units).enabled, true);

  const firstDecision = ai.chooseBattleAiDecision(state, openSea, 'player');
  assert.ok(firstDecision);
  const automatic = engine.applyCommand(state, openSea, firstDecision.command, rules.createSeededRng(7788));
  assert.equal(automatic.ok, true);
  state = automatic.state;

  const activePlayer = state.units.find((unit) => unit.side === 'player' && unit.status === 'active' && !unit.acted);
  assert.ok(activePlayer, '接手時需保留可手動操作的我方船');
  const manual = engine.applyCommand(state, openSea, { type: 'wait', unitId: activePlayer.id }, rules.createSeededRng(7788));
  assert.equal(manual.ok, true);
  const ended = engine.applyCommand(manual.state, openSea, { type: 'end_turn' }, rules.createSeededRng(7788));
  assert.equal(ended.ok, true);
  assert.equal(ended.state.activeSide, 'enemy');
});

test('1 對 1、2 對 3、5 對 5 固定 seed 自動戰鬥可完整重播', () => {
  const first = simulator.simulateBatch(36);
  const second = simulator.simulateBatch(36);
  assert.deepEqual(second, first);
  const expectedCounts = [2, 5, 10];
  first.forEach((result, index) => {
    assert.equal(result.units.length, expectedCounts[index % expectedCounts.length]);
    assert.notEqual(result.winner, null);
    assert.ok(result.round <= 12);
  });
});

console.log('\n✅ P6-2 自動戰鬥固定案例 ' + cases + ' 組全部通過（含三種艦隊規模雙次重播）');
