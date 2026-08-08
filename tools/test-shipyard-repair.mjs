// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-shipyard-repair.mjs
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
const equal = (actual, expected, message) => {
  if (actual !== expected) throw new Error(`${message}：預期 ${expected}，實際 ${actual}`);
};

function ship(typeId, hull, armor = null) {
  return { ...m.newPlayerShip(typeId, { x: 0, y: 0 }), hull, armor };
}

function stateWithFleet(ships, gold) {
  const state = m.newGame('lin');
  state.ship = ships[0];
  state.escorts = ships.slice(1);
  state.gold = gold;
  return state;
}

// 1. 每艘船都要使用自己的裝甲耐久加成。
equal(m.shipHullMax(ship('caravel', 110)), 110, '無裝甲卡拉維爾上限錯誤');
equal(m.shipHullMax(ship('caravel', 110, 'hp_wood')), 130, '木製補強上限錯誤');
equal(m.shipHullMax(ship('caravel', 110, 'hp_iron')), 160, '鐵製包板上限錯誤');
equal(m.shipHullMax(ship('caravel', 110, 'hp_copper')), 210, '銅皮船底上限錯誤');

// 2. 玩家截圖情境：104/120 朱印船與 156/160 裝甲大戎克船共需 20 點、40 兩。
const screenshotState = stateWithFleet([
  ship('fuchuan', 180),
  ship('junk_large', 140),
  ship('shuinsen', 104),
  ship('junk_large', 156, 'hp_wood'),
  ship('caravel', 130, 'hp_wood'),
], 59115);
equal(m.fleetHullMax(screenshotState), 730, '全艦隊有效耐久上限未計入僚艦裝甲');
const screenshotResult = m.repairFleetAtPrice(screenshotState, 2);
equal(screenshotResult.totalNeed, 20, '截圖情境修理需求錯誤');
equal(screenshotResult.repaired, 20, '截圖情境未完成全修');
equal(screenshotResult.cost, 40, '截圖情境修理費錯誤');
equal(screenshotState.gold, 59075, '截圖情境扣款錯誤');
equal(screenshotState.escorts[1].hull, 120, '朱印船未修滿');
equal(screenshotState.escorts[2].hull, 160, '裝甲大戎克船未修滿');
equal(screenshotState.escorts[3].hull, 130, '滿耐久裝甲船不應改變');

// 3. 超過有效上限的歷史資料不得抵銷受損船，也不得在修理時被扣耐久。
const overMaxFirst = stateWithFleet([
  ship('junk_large', 165, 'hp_wood'),
  ship('shuinsen', 104),
], 100);
const overMaxResult = m.repairFleetAtPrice(overMaxFirst, 2);
equal(overMaxResult.totalNeed, 16, '超上限船錯誤抵銷受損點數');
equal(overMaxFirst.ship.hull, 165, '修理不應降低歷史超上限耐久');
equal(overMaxFirst.escorts[0].hull, 120, '排序後的受損船未正確修理');
equal(overMaxResult.cost, 32, '混合船隊費用錯誤');

// 4. 資金只夠部分修理時，只扣實際修理費並依艦隊順序修理。
const partial = stateWithFleet([ship('shuinsen', 104)], 5);
const partialResult = m.repairFleetAtPrice(partial, 2);
equal(partialResult.totalNeed, 16, '部分修理需求錯誤');
equal(partialResult.repaired, 2, '部分修理點數錯誤');
equal(partialResult.cost, 4, '部分修理費用錯誤');
equal(partial.gold, 1, '部分修理扣款錯誤');
equal(partial.ship.hull, 106, '部分修理耐久錯誤');
assert(!partialResult.complete, '部分修理不應標成完成');

// 5. 全滿與零資金都不可改動船體或資金。
const full = stateWithFleet([ship('caravel', 130, 'hp_wood')], 50);
const fullResult = m.repairFleetAtPrice(full, 2);
equal(fullResult.totalNeed, 0, '滿耐久裝甲船不應需要修理');
assert(fullResult.complete, '全滿船隊應標成完成');
equal(full.gold, 50, '全滿船隊不應扣款');

const broke = stateWithFleet([ship('shuinsen', 104)], 0);
const brokeResult = m.repairFleetAtPrice(broke, 2);
equal(brokeResult.totalNeed, 16, '零資金仍應回報真實需求');
equal(brokeResult.repaired, 0, '零資金不應修理');
equal(broke.ship.hull, 104, '零資金不應改動耐久');

// 6. 非法單價要立即失敗，避免免費修理或除以零。
let invalidPriceFailed = false;
try {
  m.repairFleetAtPrice(stateWithFleet([ship('shuinsen', 104)], 100), 0);
} catch {
  invalidPriceFailed = true;
}
assert(invalidPriceFailed, '非法修理單價未被阻擋');

console.log('shipyard repair: 6 cases passed');
