// WP-1 主線階段引擎整合測試
// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-story-stage-engine.mjs
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
const port = (id) => m.PORTS.find((item) => item.id === id);

// 林線第2章：未完成時阻擋；探索、貿易依序鎖存後放行。
const lin = m.newGame('lin');
lin.story.chapter = 2;
assert(!m.storyAdvanceCheck(lin, port('ponkan')).ok, '林2 未完成時應阻擋過章');
lin.discoveredExplorationPoints.push('exp_siraya');
m.updateStoryStageProgress(lin);
assert(m.storyStageStatuses(lin).filter((item) => item.ok).length === 1, '林2 探索階段未鎖存');
lin.tradeStats.byPort.ponkan = 500;
m.updateStoryStageProgress(lin);
assert(m.storyStagesComplete(lin), '林2 兩階段應完成');
assert(m.storyAdvanceCheck(lin, port('ponkan')).ok, '林2 完成後應可過章');

// 林線第3章：主線具名海戰共用 duel，勝利後仍須符合原生絲條件。
lin.story.chapter = 3;
lin.story.chapterStages = {};
lin.cargo.silk_raw = 5;
const duel = m.pendingStoryDuel(lin);
assert(duel?.name === '騷擾安海航線的海盜', '林3 具名敵船錯誤');
m.completeStoryDuel(lin, 'lin_03');
assert(m.storyAdvanceCheck(lin, port('anhai')).ok, '林3 決鬥與生絲完成後應可過章');

// 彼得造訪、千代探索型各抽一章。
const peter = m.newGame('peter');
peter.story.chapter = 2;
peter.visitedPorts.push('macau');
m.updateStoryStageProgress(peter);
assert(m.storyAdvanceCheck(peter, port('penghu')).ok, '彼得2 澳門造訪未生效');
const chiyo = m.newGame('chiyo');
chiyo.story.chapter = 4;
chiyo.discoveredExplorationPoints.push('exp_ryukyu_shuri');
chiyo.cargo.silk_raw = 5;
m.updateStoryStageProgress(chiyo);
assert(m.storyAdvanceCheck(chiyo, port('naha')).ok, '千代4 首里探索未生效');

// v18 半途存檔：已完成章節回填，當前章節保持未完成。
const old = m.newGame('lin');
old.version = 18;
old.story.chapter = 4;
old.story.completed = ['lin_01', 'lin_02', 'lin_03'];
delete old.story.chapterStages;
localStorage.setItem('seagame_save_slot0', JSON.stringify(old));
const loaded = m.loadGame(0);
assert(loaded?.version === m.SAVE_VERSION, 'v18 存檔未連續升級至最新版');
assert(loaded?.reputationEvents && Object.keys(loaded.reputationEvents).length === 0, 'v18 存檔未補上 v20 聲望事件進度');
assert((loaded.story.chapterStages.lin_02 ?? []).length === 2, 'v18 已完成 lin_02 未完整回填');
assert((loaded.story.chapterStages.lin_03 ?? []).length === 1, 'v18 已完成 lin_03 未完整回填');
assert((loaded.story.chapterStages.lin_04 ?? []).length === 0, 'v18 當前章節不應預先完成');

console.log('✅ 主線階段引擎測試通過：阻擋／鎖存／具名海戰／三線抽測／v18→最新版連續遷移');
