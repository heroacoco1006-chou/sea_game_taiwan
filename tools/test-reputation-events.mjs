// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-reputation-events.mjs
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
const event = (id) => m.reputationEventById(id);

const trade = m.newGame('lin');
trade.reputation.trade = 39;
assert(!m.reputationEventAvailableAtPort(trade, event('rep_trade_40'), 'yuegang'), '39 聲望不應解鎖 40 階事件');
trade.reputation.trade = 40;
assert(m.reputationEventAvailableAtPort(trade, event('rep_trade_40'), 'yuegang'), '40 聲望應在月港解鎖事件');
assert(m.acceptReputationEvent(trade, 'rep_trade_40', 'yuegang').ok, '商人 40 事件接取失敗');
trade.cargo.silk_raw = 12;
trade.costBasis.silk_raw = 1200;
assert(m.reportReputationEventStage(trade, 'rep_trade_40', 'hirado').ok, '商人 40 事件交付失敗');
const beforeGold = trade.gold;
assert(m.completeReputationEvent(trade, 'rep_trade_40', 'hirado').ok, '商人 40 事件結算失敗');
assert(trade.gold === beforeGold + 1200, '商人 40 金錢獎勵不正確');
assert(trade.story.codex.includes('rep_codex_trade_40'), '商人 40 圖鑑未解鎖');
assert(!m.completeReputationEvent(trade, 'rep_trade_40', 'hirado').ok, '同一事件不可重複結算');

trade.reputation.trade = 80;
assert(m.reputationEventAvailableAtPort(trade, event('rep_trade_80'), 'hirado'), '完成前置後商人 80 應解鎖');
assert(m.acceptReputationEvent(trade, 'rep_trade_80', 'hirado').ok, '商人 80 事件接取失敗');
Object.assign(trade.cargo, { silk_cloth: 6, silver: 4, pepper: 4 });
assert(m.reportReputationEventStage(trade, 'rep_trade_80', 'tayouan').ok, '商人 80 三地貨物交付失敗');
assert(m.completeReputationEvent(trade, 'rep_trade_80', 'tayouan').ok, '商人 80 結算失敗');
assert(trade.inventory.ac_merchant_credit === 1, '海商信用牌未唯一發放');
assert(m.sellInventoryItem(trade, 'ac_merchant_credit').includes('不能賣掉'), '唯一稀有道具不應能賣掉');
assert(trade.inventory.ac_merchant_credit === 1, '嘗試出售後稀有道具不應消失');

const adventure = m.newGame('lin');
adventure.reputation.adventure = 40;
assert(m.acceptReputationEvent(adventure, 'rep_adventure_40', 'penghu').ok, '冒險 40 事件接取失敗');
adventure.discoveredExplorationPoints.push('exp_ryukyu_shuri', 'exp_sakai_route');
assert(m.reportReputationEventStage(adventure, 'rep_adventure_40', 'naha').ok, '冒險 40 回報失敗');
assert(m.completeReputationEvent(adventure, 'rep_adventure_40', 'naha').ok, '冒險 40 結算失敗');

const valor = m.newGame('lin');
valor.reputation.valor = 40;
assert(m.acceptReputationEvent(valor, 'rep_valor_40', 'penghu').ok, '威名 40 事件接取失敗');
const duel = m.pendingReputationDuel(valor);
assert(duel?.name === '冒旗勒索船隊' && m.pendingQuestDuel(valor)?.kind === 'reputation', '聲望具名海戰未進入共用任務決鬥');
assert(m.completeReputationDuel(valor, 'rep_valor_40').length > 0, '聲望具名海戰勝利未鎖存');
assert(m.completeReputationEvent(valor, 'rep_valor_40', 'penghu').ok, '威名 40 結算失敗');

const parallel = m.newGame('lin');
parallel.reputation.trade = 40;
parallel.reputation.valor = 40;
assert(m.acceptReputationEvent(parallel, 'rep_trade_40', 'yuegang').ok, '並行測試的商人事件接取失敗');
assert(m.acceptReputationEvent(parallel, 'rep_valor_40', 'penghu').ok, '並行測試的威名事件接取失敗');
assert(m.pendingReputationDuel(parallel)?.name === '冒旗勒索船隊', '非決鬥事件不可擋住另一條聲望決鬥');

console.log('✅ 聲望特殊事件引擎測試通過：門檻／前置／交付／探索／決鬥／一次性獎勵／圖鑑／稀有道具');
