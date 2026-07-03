// 夥伴資料完整性測試（交接文件第五階段）：
// 檢查 25 位夥伴的港口、職位、任務階段引用（貨物／探索點／圖鑑／港口／聲望／能力值）、
// 對話句數、任務階段數是否符合建構書與驗收標準。
// 用法：node tools/validate-mates-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const matesData = read('src/data/mates.json');
const ports = new Set(read('src/data/ports.json').ports.map((p) => p.id));
const goods = new Set(read('src/data/goods.json').goods.map((g) => g.id));
const expPoints = new Set(read('src/data/exploration_points.json').points.map((p) => p.id));
const codexIds = new Set(read('src/data/codex.json').entries.map((e) => e.id));
const roleKeys = new Set(matesData.roles.map((r) => r.key));

const HERO_IDS = new Set(['lin', 'peter', 'chiyo']);
const REP_KINDS = new Set(['adventure', 'trade', 'valor']);
const STAT_KEYS = new Set(['lead', 'gun', 'val', 'nav', 'kno', 'neg']);
const FACTIONS = new Set(['sinckan']);

const errors = [];
const warnings = [];
const err = (m, msg) => errors.push(`[${m.id ?? '?'}] ${msg}`);
const warn = (m, msg) => warnings.push(`[${m.id ?? '?'}] ${msg}`);

function checkRequirement(m, req, where) {
  if (!req) return;
  for (const h of req.heroIds ?? []) if (!HERO_IDS.has(h)) err(m, `${where}：未知主角 id「${h}」`);
  for (const c of req.cargo ?? []) {
    if (!goods.has(c.goodId)) err(m, `${where}：未知貨物 id「${c.goodId}」`);
    if (!(c.qty > 0)) err(m, `${where}：貨物數量不正確（${c.qty}）`);
  }
  for (const p of req.discoveredExplorationPoints ?? []) if (!expPoints.has(p)) err(m, `${where}：未知探索點「${p}」`);
  for (const c of req.codexIds ?? []) if (!codexIds.has(c)) err(m, `${where}：未知圖鑑 id「${c}」`);
  for (const k of Object.keys(req.reputation ?? {})) if (!REP_KINDS.has(k)) err(m, `${where}：未知聲望軌道「${k}」`);
  for (const f of Object.keys(req.friendship ?? {})) if (!FACTIONS.has(f)) err(m, `${where}：未知勢力 id「${f}」`);
  for (const k of Object.keys(req.stats ?? {})) if (!STAT_KEYS.has(k)) err(m, `${where}：未知能力值 key「${k}」`);
  for (const p of req.visitPorts ?? []) if (!ports.has(p)) err(m, `${where}：未知港口 id「${p}」`);
  if (req.tradeAtPort && !ports.has(req.tradeAtPort.portId)) err(m, `${where}：tradeAtPort 未知港口「${req.tradeAtPort.portId}」`);
  if (req.minChapter && req.maxChapter && req.minChapter > req.maxChapter) err(m, `${where}：minChapter > maxChapter`);
}

const mates = matesData.mates;
if (mates.length !== 25) errors.push(`夥伴數量應為 25，實際 ${mates.length}`);
const ids = new Set();
let questCount = 0;
let stageCount = 0;
let dialogueCount = 0;

for (const m of mates) {
  if (ids.has(m.id)) err(m, '重複 id');
  ids.add(m.id);
  if (!ports.has(m.portId)) err(m, `未知港口 id「${m.portId}」`);
  if (!(m.fee >= 0)) err(m, `費用不正確（${m.fee}）`);
  if (!(m.star >= 1 && m.star <= 5)) err(m, `星級不正確（${m.star}）`);
  for (const r of m.roles) if (!roleKeys.has(r)) err(m, `未知職位「${r}」`);
  if (!m.questTitle) err(m, '缺 questTitle');
  if (!m.codexBody) err(m, '缺 codexBody');

  // 專屬對話（建構書 §5-7：每人 5～10 句）
  const dialogues = m.dialogues ?? [];
  dialogueCount += dialogues.length;
  if (dialogues.length < 5 || dialogues.length > 10) err(m, `專屬對話應為 5～10 句，實際 ${dialogues.length}`);

  checkRequirement(m, m.requirement, 'requirement');

  const stages = m.questStages ?? [];
  if (stages.length) {
    questCount += 1;
    stageCount += stages.length;
    if (!m.questIntro) warn(m, '有任務但缺 questIntro（接取開場對話）');
    // 驗收標準 3：★4～5 至少 2 階段；★5 建議 3～4 階段
    if (m.star >= 4 && stages.length < 2) err(m, `★${m.star} 任務僅 ${stages.length} 階段（至少 2）`);
    if (m.star === 5 && (stages.length < 3 || stages.length > 4)) warn(m, `★5 建議 3～4 階段，實際 ${stages.length}`);
    stages.forEach((st, i) => {
      if (!st.title || !st.desc) err(m, `第 ${i + 1} 階段缺 title/desc`);
      checkRequirement(m, st.requirement, `階段${i + 1}`);
      if (st.consumeCargo && !(st.requirement?.cargo?.length)) err(m, `階段${i + 1}：consumeCargo 但 requirement 沒有 cargo`);
      if (st.duel && (!st.duel.name || !(st.duel.tier >= 1))) err(m, `階段${i + 1}：duel 欄位不完整`);
      if (st.duel && (st.reportAtPort || st.consumeCargo)) err(m, `階段${i + 1}：duel 不可與回報類混用`);
      if (!st.dialogue) warn(m, `階段${i + 1} 缺完成對話 dialogue`);
    });
  }
  const guests = Array.isArray(m.guest) ? m.guest : m.guest ? [m.guest] : [];
  for (const g of guests) {
    if (!(g.leaveAfterChapter >= 1 && g.leaveText)) err(m, 'guest 欄位不完整');
    for (const h of g.heroIds ?? []) if (!HERO_IDS.has(h)) err(m, `guest：未知主角 id「${h}」`);
  }
  if (m.autoJoin) {
    if (!HERO_IDS.has(m.autoJoin.heroId)) err(m, `autoJoin：未知主角 id「${m.autoJoin.heroId}」`);
    if (!(m.autoJoin.chapter >= 1)) err(m, 'autoJoin：chapter 不正確');
    // 自動同行的主角線若同時是客座，離隊章不可早於加入章
    const g = guests.find((x) => !x.heroIds || x.heroIds.includes(m.autoJoin.heroId));
    if (g && g.leaveAfterChapter < m.autoJoin.chapter) err(m, 'autoJoin 章節晚於客座離隊章');
  }
}

console.log(`夥伴 ${mates.length} 位｜含專屬任務 ${questCount} 位｜任務階段 ${stageCount} 段｜日常對話 ${dialogueCount} 句`);
if (warnings.length) {
  console.log(`\n⚠ 提醒 ${warnings.length} 筆：`);
  for (const w of warnings) console.log('  ' + w);
}
if (errors.length) {
  console.error(`\n✖ 錯誤 ${errors.length} 筆：`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('\n✅ 資料完整性檢查通過');
