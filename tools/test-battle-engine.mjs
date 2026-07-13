// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-battle-engine.mjs
import assert from 'node:assert/strict';
import mapsData from '../src/data/battleMaps.json' with { type: 'json' };

const rules = await import('../src/battle/battleRules.ts');
const engine = await import('../src/battle/battleEngine.ts');
const hexMath = await import('../src/battle/hex.ts');
// 地圖資料的地形／部署以「欄列」撰寫；引擎內部是 axial。測試用 at(欄,列) 表達位置。
const at = (col, row) => hexMath.offsetToAxial(col, row);
const atKey = (col, row) => hexMath.hexKey(at(col, row));
const mapById = (id) => mapsData.maps.find((map) => map.id === id);
const openSea = mapById('open_sea');
const islandChannel = mapById('island_channel');
const reefPassage = mapById('reef_passage');
const EXPECTED_ERRORS = [
  'BATTLE_OVER', 'UNIT_NOT_FOUND', 'TARGET_NOT_FOUND', 'WRONG_SIDE', 'UNIT_INACTIVE', 'FRIENDLY_TARGET',
  'ALREADY_MOVED', 'ALREADY_ACTED', 'INVALID_PATH', 'OUT_OF_BOUNDS', 'IMPASSABLE', 'OCCUPIED',
  'INSUFFICIENT_MOVE', 'INVALID_FACING', 'NO_CANNONS', 'OUT_OF_RANGE', 'NOT_BROADSIDE', 'BLOCKED_LOS',
  'NOT_ADJACENT', 'REPAIR_ALREADY_USED', 'FULL_HULL', 'NOT_ON_RETREAT_EDGE',
];
const observedErrors = new Set();

const makeUnit = (overrides = {}) => ({
  id: 'p1', side: 'player', shipTypeId: 'junk_small', shipSize: 'small', flagship: true,
  hex: { q: 2, r: 2 }, facing: 0, hull: 100, hullMax: 100,
  cannons: 4, cannonTypeId: 'standard', cannonPower: 1, gunnerMod: 1, armorMultiplier: 1,
  crew: 30, boardingBonus: 0, crewLossMultiplier: 1,
  movePoints: 3, moveSpent: 0, moved: false, acted: false, repaired: false, status: 'active',
  ...overrides,
  hex: { q: 2, r: 2, ...(overrides.hex ?? {}) },
});
const makeEnemy = (overrides = {}) => makeUnit({
  id: 'e1', side: 'enemy', flagship: true, hex: { q: 2, r: 4 }, facing: 3,
  ...overrides,
});
const makeState = (units = [makeUnit(), makeEnemy()], overrides = {}) => ({
  ...engine.createBattleState({ seed: 12345, mapId: 'open_sea', units }),
  ...overrides,
});

let cases = 0;
const test = (name, run) => {
  run();
  cases += 1;
  console.log(`✓ ${name}`);
};
const apply = (state, command, map = openSea, seed = 7) => engine.applyCommand(state, map, command, rules.createSeededRng(seed));
const expectError = (name, state, command, expected, map = openSea) => {
  const before = JSON.parse(JSON.stringify(state));
  const result = apply(state, command, map);
  assert.equal(result.ok, false, `${name} 應失敗`);
  assert.equal(result.error, expected, `${name} error code`);
  observedErrors.add(result.error);
  assert.strictEqual(result.state, state, `${name} 必須回傳原 state 參照`);
  assert.deepEqual(state, before, `${name} 不得改動 state`);
  assert.deepEqual(result.events, []);
};

test('移動範圍依成本、地形與占用格計算', () => {
  // open_sea 淺灘在欄4列1、欄5列1；大型船站欄3列1（相鄰淺灘）
  const player = makeUnit({ id: 'p1', shipSize: 'large', hex: at(3, 1), movePoints: 2 });
  const blocker = makeUnit({ id: 'p2', flagship: false, hex: at(3, 2) });
  const units = [player, blocker, makeEnemy({ hex: at(10, 3) })];
  const reachable = rules.reachableHexes(openSea, units, player);
  const byKey = new Map(reachable.map((item) => [`${item.hex.q},${item.hex.r}`, item.cost]));
  assert.equal(byKey.get(atKey(4, 1)), 2, '大型船進淺灘成本應為 2');
  assert.equal(byKey.has(atKey(3, 2)), false, '占用格不可到達');
  assert.equal(byKey.has(atKey(5, 1)), false, '移動力不足不可穿過淺灘');
});

test('findPath 直線、淺灘成本、繞島與不可達皆正確', () => {
  // 直線：深海 (2,2) → (5,2)，移動力 3 剛好
  const straight = rules.findPath(openSea, [makeUnit(), makeEnemy({ hex: at(10, 3) })], makeUnit(), { q: 5, r: 2 });
  assert.deepEqual(straight, [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }, { q: 5, r: 2 }]);
  // 淺灘：大型船預算 2 可進欄4列1（成本2），到不了欄5列1
  const large = makeUnit({ shipSize: 'large', hex: at(3, 1), movePoints: 2 });
  const largeUnits = [large, makeEnemy({ hex: at(10, 3) })];
  assert.notEqual(rules.findPath(openSea, largeUnits, large, at(4, 1)), null);
  assert.equal(rules.findPath(openSea, largeUnits, large, at(5, 1)), null);
  // 繞島：island_channel 島在欄5列2～4；欄4列3 → 欄6列3 必須繞行且路徑合法
  const sailor = makeUnit({ hex: at(4, 3), movePoints: 5 });
  const sailorUnits = [sailor, makeEnemy({ hex: at(10, 3) })];
  const around = rules.findPath(islandChannel, sailorUnits, sailor, at(6, 3));
  assert.notEqual(around, null);
  for (const cell of around) assert.notEqual(rules.terrainAt(islandChannel, cell), 'land');
  const validated = rules.validatePath(islandChannel, sailorUnits, sailor, around);
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.value.destination, at(6, 3));
  // 目的格被占用 → null
  const blockedUnits = [makeUnit(), makeUnit({ id: 'p2', flagship: false, hex: { q: 3, r: 2 } }), makeEnemy({ hex: at(10, 3) })];
  assert.equal(rules.findPath(openSea, blockedUnits, makeUnit(), { q: 3, r: 2 }), null);
});

test('合法路徑更新格位、朝向、成本且不修改輸入 state', () => {
  const state = makeState([makeUnit({ hex: { q: 2, r: 2 } }), makeEnemy({ hex: at(10, 4) })]);
  const before = JSON.parse(JSON.stringify(state));
  const result = apply(state, { type: 'move', unitId: 'p1', path: [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 3, r: 3 }] });
  assert.equal(result.ok, true);
  assert.deepEqual(state, before);
  const moved = result.state.units.find((unit) => unit.id === 'p1');
  assert.deepEqual(moved.hex, { q: 3, r: 3 });
  assert.equal(moved.facing, 1);
  assert.equal(moved.moveSpent, 2);
  assert.equal(moved.moved, true);
});

test('左右轉消耗 1 移動力，仍可使用剩餘移動力', () => {
  let state = makeState([makeUnit({ hex: { q: 2, r: 2 }, movePoints: 3 }), makeEnemy({ hex: at(10, 4) })]);
  const turned = apply(state, { type: 'turn', unitId: 'p1', facing: 1 });
  assert.equal(turned.ok, true);
  assert.equal(turned.state.units[0].moveSpent, 1);
  state = turned.state;
  const moved = apply(state, { type: 'move', unitId: 'p1', path: [{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }] });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.units[0].moveSpent, 3);
});

test('砲擊固定 seed 可重播且傷害落在預估範圍', () => {
  const state = makeState();
  const attacker = state.units[0];
  const target = state.units[1];
  const bounds = rules.cannonDamageBounds(attacker, target, 2);
  const first = apply(state, { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, openSea, 2468);
  const second = apply(state, { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, openSea, 2468);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  const damage = first.events.find((event) => event.type === 'cannon_fired').damage;
  assert.ok(damage >= bounds.minimum && damage <= bounds.maximum);
});

test('砲擊擊沉敵方旗艦立即勝利', () => {
  const state = makeState([makeUnit({ cannons: 10 }), makeEnemy({ hull: 1, hullMax: 100 })]);
  const result = apply(state, { type: 'cannon', attackerId: 'p1', targetId: 'e1' });
  assert.equal(result.ok, true);
  assert.equal(result.state.units[1].status, 'sunk');
  assert.equal(result.state.winner, 'player');
  assert.equal(result.state.resultReason, 'ENEMY_FLAGSHIP_SUNK');
});

test('接舷優勢只使目標單船投降並結算旗艦', () => {
  const state = makeState([
    makeUnit({ crew: 100, boardingBonus: 50, hex: { q: 2, r: 2 } }),
    makeEnemy({ crew: 5, hex: { q: 2, r: 3 } }),
  ]);
  const result = apply(state, { type: 'board', attackerId: 'p1', targetId: 'e1' }, openSea, 3);
  assert.equal(result.ok, true);
  assert.equal(result.events.find((event) => event.type === 'boarding').outcome, 'won');
  assert.equal(result.state.units[1].status, 'surrendered');
  assert.equal(result.state.winner, 'player');
});

test('修整依 5%／3～12 規則且每場只能一次', () => {
  const state = makeState([makeUnit({ hull: 90, hullMax: 100 }), makeEnemy()]);
  const result = apply(state, { type: 'repair', unitId: 'p1' });
  assert.equal(result.ok, true);
  assert.equal(result.state.units[0].hull, 95);
  assert.equal(result.state.units[0].repaired, true);
  assert.equal(result.state.units[0].acted, true);
});

test('全體由己方邊界撤退視為成功脫離', () => {
  const state = makeState([makeUnit({ hex: { q: 0, r: 3 } }), makeEnemy({ hex: at(10, 3) })]);
  const result = apply(state, { type: 'retreat', unitId: 'p1' });
  assert.equal(result.ok, true);
  assert.equal(result.state.winner, 'draw');
  assert.equal(result.state.resultReason, 'PLAYER_RETREATED');
});

test('玩家／敵方全隊回合切換並重設該方行動狀態', () => {
  const player = makeUnit({ moved: true, acted: true, moveSpent: 3 });
  const enemy = makeEnemy({ moved: true, acted: true, moveSpent: 3 });
  let state = makeState([player, enemy]);
  let result = apply(state, { type: 'end_turn' });
  assert.equal(result.ok, true);
  assert.equal(result.state.activeSide, 'enemy');
  assert.equal(result.state.units[1].acted, false);
  state = result.state;
  result = apply(state, { type: 'end_turn' });
  assert.equal(result.ok, true);
  assert.equal(result.state.round, 2);
  assert.equal(result.state.activeSide, 'player');
  assert.equal(result.state.units[0].moved, false);
  assert.equal(result.state.units[0].moveSpent, 0);
});

test('第 12 回合結束一定產生結果', () => {
  let state = makeState([makeUnit(), makeEnemy()]);
  for (let turns = 0; turns < 24 && state.winner === null; turns += 1) {
    const result = apply(state, { type: 'end_turn' });
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.round, 12);
  assert.notEqual(state.winner, null);
  assert.equal(state.phase, 'result');
  assert.ok(['TURN_LIMIT_PLAYER_WIN', 'TURN_LIMIT_PLAYER_RETREAT'].includes(state.resultReason));
});

test('固定 seed 指令序列可完整重播', () => {
  const commands = [
    { type: 'cannon', attackerId: 'p1', targetId: 'e1' },
    { type: 'end_turn' },
    { type: 'wait', unitId: 'e1' },
    { type: 'end_turn' },
    { type: 'cannon', attackerId: 'p1', targetId: 'e1' },
  ];
  const replay = () => {
    let state = makeState([makeUnit({ cannons: 1 }), makeEnemy({ hull: 500, hullMax: 500 })]);
    const rng = rules.createSeededRng(9988);
    const events = [];
    for (const command of commands) {
      const result = engine.applyCommand(state, openSea, command, rng);
      assert.equal(result.ok, true);
      state = result.state;
      events.push(...result.events);
    }
    return { state, events };
  };
  assert.deepEqual(replay(), replay());
});

test('所有穩定非法指令 error code 都保持原 state 不變', () => {
  expectError('BATTLE_OVER', makeState(undefined, { phase: 'result', winner: 'player' }), { type: 'end_turn' }, 'BATTLE_OVER');
  expectError('UNIT_NOT_FOUND', makeState(), { type: 'wait', unitId: 'missing' }, 'UNIT_NOT_FOUND');
  expectError('TARGET_NOT_FOUND', makeState(), { type: 'cannon', attackerId: 'p1', targetId: 'missing' }, 'TARGET_NOT_FOUND');
  expectError('WRONG_SIDE', makeState(), { type: 'wait', unitId: 'e1' }, 'WRONG_SIDE');
  expectError('UNIT_INACTIVE', makeState([makeUnit({ status: 'sunk' }), makeEnemy()]), { type: 'select', unitId: 'p1' }, 'UNIT_INACTIVE');
  expectError('FRIENDLY_TARGET', makeState([makeUnit(), makeUnit({ id: 'p2', flagship: false, hex: { q: 2, r: 4 } }), makeEnemy({ hex: at(10, 4) })]), { type: 'cannon', attackerId: 'p1', targetId: 'p2' }, 'FRIENDLY_TARGET');
  expectError('ALREADY_MOVED', makeState([makeUnit({ moved: true }), makeEnemy()]), { type: 'move', unitId: 'p1', path: [{ q: 2, r: 2 }] }, 'ALREADY_MOVED');
  expectError('ALREADY_ACTED', makeState([makeUnit({ acted: true }), makeEnemy()]), { type: 'wait', unitId: 'p1' }, 'ALREADY_ACTED');
  expectError('INVALID_PATH', makeState(), { type: 'move', unitId: 'p1', path: [{ q: 3, r: 2 }] }, 'INVALID_PATH');
  expectError('OUT_OF_BOUNDS', makeState([makeUnit({ hex: { q: 0, r: 0 } }), makeEnemy()]), { type: 'move', unitId: 'p1', path: [{ q: 0, r: 0 }, { q: -1, r: 0 }] }, 'OUT_OF_BOUNDS');
  expectError('IMPASSABLE', makeState([makeUnit({ hex: at(3, 1) }), makeEnemy()]), { type: 'move', unitId: 'p1', path: [at(3, 1), at(4, 1)] }, 'IMPASSABLE', reefPassage);
  expectError('OCCUPIED', makeState([makeUnit(), makeUnit({ id: 'p2', flagship: false, hex: { q: 3, r: 2 } }), makeEnemy()]), { type: 'move', unitId: 'p1', path: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }, 'OCCUPIED');
  expectError('INSUFFICIENT_MOVE', makeState([makeUnit({ movePoints: 0 }), makeEnemy()]), { type: 'move', unitId: 'p1', path: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }, 'INSUFFICIENT_MOVE');
  expectError('INVALID_FACING', makeState(), { type: 'turn', unitId: 'p1', facing: 2 }, 'INVALID_FACING');
  expectError('NO_CANNONS', makeState([makeUnit({ cannons: 0 }), makeEnemy()]), { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, 'NO_CANNONS');
  expectError('OUT_OF_RANGE', makeState([makeUnit(), makeEnemy({ hex: at(8, 6) })]), { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, 'OUT_OF_RANGE');
  expectError('NOT_BROADSIDE', makeState([makeUnit({ facing: 0 }), makeEnemy({ hex: { q: 3, r: 2 } })]), { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, 'NOT_BROADSIDE');
  expectError('BLOCKED_LOS', makeState([makeUnit({ hex: at(3, 3), facing: 1, cannonTypeId: 'ct_hongyi' }), makeEnemy({ hex: at(6, 3) })]), { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, 'BLOCKED_LOS', islandChannel);
  expectError('NOT_ADJACENT', makeState(), { type: 'board', attackerId: 'p1', targetId: 'e1' }, 'NOT_ADJACENT');
  expectError('REPAIR_ALREADY_USED', makeState([makeUnit({ hull: 80, repaired: true }), makeEnemy()]), { type: 'repair', unitId: 'p1' }, 'REPAIR_ALREADY_USED');
  expectError('FULL_HULL', makeState(), { type: 'repair', unitId: 'p1' }, 'FULL_HULL');
  expectError('NOT_ON_RETREAT_EDGE', makeState(), { type: 'retreat', unitId: 'p1' }, 'NOT_ON_RETREAT_EDGE');
  assert.deepEqual([...observedErrors].sort(), [...EXPECTED_ERRORS].sort());
});

test('側舷、島嶼阻擋與暗礁不阻擋 LOS 規則固定', () => {
  // island_channel 島嶼在欄5列2～4；欄3列3 → 欄6列3 的砲線會穿過島嶼
  const attacker = makeUnit({ hex: at(3, 3), facing: 1, cannonTypeId: 'ct_hongyi' });
  const broadsideTarget = makeEnemy({ hex: at(6, 3) });
  assert.equal(rules.isBroadside(attacker, broadsideTarget), true);
  assert.equal(rules.hasLineOfSight(islandChannel, attacker.hex, broadsideTarget.hex), false);
  // reef_passage 暗礁在欄4列1（axial (4,-1)）；欄3列0 → 欄5列1 的直線砲線經過暗礁但不被阻擋
  const reefAttacker = makeUnit({ hex: at(3, 0), facing: 1, cannonTypeId: 'ct_hongyi' });
  const reefTarget = makeEnemy({ hex: at(5, 1) });
  assert.deepEqual(hexMath.hexLine(reefAttacker.hex, reefTarget.hex)[1], at(4, 1), '砲線需確實經過暗礁格');
  assert.equal(rules.hasLineOfSight(reefPassage, reefAttacker.hex, reefTarget.hex), true);
  assert.equal(rules.isBroadside(makeUnit({ facing: 0 }), makeEnemy({ hex: { q: 3, r: 2 } })), false);
});

test('接舷勝出、勢均力敵與失敗三種結果固定', () => {
  const middle = () => 0.5;
  assert.equal(rules.resolveBoarding(makeUnit({ crew: 100 }), makeEnemy({ crew: 10 }), middle).outcome, 'won');
  const balanced = rules.resolveBoarding(makeUnit({ crew: 30 }), makeEnemy({ crew: 30 }), middle);
  assert.equal(balanced.outcome, 'balanced');
  assert.ok(balanced.attackerCrewLoss > 0 && balanced.targetCrewLoss > 0);
  const lost = rules.resolveBoarding(makeUnit({ crew: 5 }), makeEnemy({ crew: 100 }), middle);
  assert.equal(lost.outcome, 'lost');
  assert.ok(lost.attackerCrewLoss > 0);
  assert.equal(lost.targetCrewLoss, 0);
});

test('修整量遵守最低 3 與最高 12', () => {
  assert.equal(rules.repairAmount(makeUnit({ hullMax: 40 })), 3);
  assert.equal(rules.repairAmount(makeUnit({ hullMax: 1000 })), 12);
});

test('12 回合比分較高時判定玩家普通勝利', () => {
  let state = makeState([makeUnit({ hull: 100, hullMax: 100 }), makeEnemy({ hull: 10, hullMax: 100 })]);
  for (let turns = 0; turns < 24 && state.winner === null; turns += 1) {
    const result = apply(state, { type: 'end_turn' });
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.winner, 'player');
  assert.equal(state.resultReason, 'TURN_LIMIT_PLAYER_WIN');
});
test('P5 砲擊預估範圍涵蓋固定 seed 實際事件值', () => {
  const attacker = makeUnit({ cannons: 5, facing: 1, hex: at(3, 3) });
  const target = makeEnemy({ hull: 1000, hullMax: 1000, hex: at(5, 3) });
  const validation = rules.validateCannonAttack(openSea, attacker, target);
  assert.equal(validation.ok, true);
  const bounds = rules.cannonDamageBounds(attacker, target, validation.value.range);
  for (let seed = 1; seed <= 64; seed += 1) {
    const state = makeState([attacker, target]);
    const result = apply(state, { type: 'cannon', attackerId: 'p1', targetId: 'e1' }, openSea, seed);
    assert.equal(result.ok, true);
    const event = result.events.find((item) => item.type === 'cannon_fired');
    assert.ok(event.damage >= bounds.minimum && event.damage <= bounds.maximum);
    assert.equal(state.units[1].hull - result.state.units[1].hull, event.damage);
  }
});

test('P5 接舷預覽與引擎共用同一合法性規則', () => {
  const attacker = makeUnit({ hex: at(3, 3) });
  const adjacent = makeEnemy({ hex: at(4, 3) });
  const distant = makeEnemy({ hex: at(6, 3) });
  assert.equal(rules.validateBoardingAttack(attacker, adjacent).ok, true);
  assert.deepEqual(rules.validateBoardingAttack(attacker, distant), { ok: false, error: 'NOT_ADJACENT' });
  const state = makeState([attacker, distant]);
  const result = apply(state, { type: 'board', attackerId: 'p1', targetId: 'e1' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'NOT_ADJACENT');
});

test('P5 修整與接舷事件數值等於引擎狀態差', () => {
  const repairState = makeState([makeUnit({ hull: 80, hullMax: 100 }), makeEnemy()]);
  const repaired = apply(repairState, { type: 'repair', unitId: 'p1' });
  assert.equal(repaired.ok, true);
  const repairEvent = repaired.events.find((item) => item.type === 'unit_repaired');
  assert.equal(repaired.state.units[0].hull - repairState.units[0].hull, repairEvent.amount);

  const boardState = makeState([
    makeUnit({ crew: 40, hex: at(3, 3) }),
    makeEnemy({ crew: 40, hex: at(4, 3) }),
  ]);
  const boarded = apply(boardState, { type: 'board', attackerId: 'p1', targetId: 'e1' }, openSea, 42);
  assert.equal(boarded.ok, true);
  const crewEvents = boarded.events.filter((item) => item.type === 'crew_changed');
  for (const event of crewEvents) {
    const before = boardState.units.find((unit) => unit.id === event.unitId).crew;
    const after = boarded.state.units.find((unit) => unit.id === event.unitId).crew;
    assert.equal(after - before, event.amount);
  }
});

console.log(`\n✅ P2～P5 純規則引擎固定案例 ${cases} 組全部通過`);
