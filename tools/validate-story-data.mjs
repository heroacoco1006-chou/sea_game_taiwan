// 主線資料完整性驗證（WP-1）：node tools/validate-story-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const story = read('src/data/story.json');
const ports = new Set(read('src/data/ports.json').ports.map((item) => item.id));
const goods = new Set(read('src/data/goods.json').goods.map((item) => item.id));
const points = new Set(read('src/data/exploration_points.json').points.map((item) => item.id));
const heroIds = new Set(story.heroes.map((hero) => hero.id));
const errors = [];
let stageCount = 0;

function error(chapter, message) {
  errors.push('[' + (chapter?.id ?? '?') + '] ' + message);
}

function checkRequirement(chapter, requirement, where) {
  if (!requirement) return;
  for (const item of requirement.cargo ?? []) {
    if (!goods.has(item.goodId)) error(chapter, where + '：未知貨物 id「' + item.goodId + '」');
    if (!(item.qty > 0)) error(chapter, where + '：貨物數量必須大於 0');
  }
  for (const pointId of requirement.discoveredExplorationPoints ?? []) {
    if (!points.has(pointId)) error(chapter, where + '：未知探索點「' + pointId + '」');
  }
  for (const portId of requirement.visitPorts ?? []) {
    if (!ports.has(portId)) error(chapter, where + '：未知港口「' + portId + '」');
  }
  if (requirement.tradeAtPort) {
    if (!ports.has(requirement.tradeAtPort.portId)) error(chapter, where + '：tradeAtPort 未知港口「' + requirement.tradeAtPort.portId + '」');
    if (!(requirement.tradeAtPort.min > 0)) error(chapter, where + '：tradeAtPort.min 必須大於 0');
  }
}

const ids = new Set();
for (const chapter of story.chapters) {
  if (ids.has(chapter.id)) error(chapter, '章節 id 重複');
  ids.add(chapter.id);
  if (!heroIds.has(chapter.heroId)) error(chapter, '未知主角 id「' + chapter.heroId + '」');
  if (!ports.has(chapter.targetPortId)) error(chapter, '未知目標港口「' + chapter.targetPortId + '」');
  checkRequirement(chapter, chapter.requirements, '章節條件');
  const stages = chapter.stages ?? [];
  stageCount += stages.length;
  if (stages.length > 3) error(chapter, '中途任務不可超過 3 個');
  if ((chapter.chapter === 1 || chapter.chapter === 10) && stages.length) error(chapter, '第 1／10 章不可設定中途任務');
  stages.forEach((stage, index) => {
    const where = '中途任務' + (index + 1);
    if (!stage.title || !stage.desc) error(chapter, where + ' 缺 title／desc');
    checkRequirement(chapter, stage.requirement, where);
    if (stage.reportAtPort || stage.consumeCargo) error(chapter, where + '：WP-1 不使用夥伴回報／交付欄位');
    if (stage.duel && (!stage.duel.name || !(stage.duel.tier >= 1 && stage.duel.tier <= 3))) error(chapter, where + '：duel 欄位不完整或 tier 超出 1～3');
    if (!stage.duel && !stage.requirement) error(chapter, where + '：必須有 requirement 或 duel');
  });
}

function requirementMet(state, requirement) {
  if (!requirement) return true;
  if ((requirement.cargo ?? []).some((item) => (state.cargo[item.goodId] ?? 0) < item.qty)) return false;
  if ((requirement.discoveredExplorationPoints ?? []).some((id) => !state.points.has(id))) return false;
  if ((requirement.visitPorts ?? []).some((id) => !state.ports.has(id))) return false;
  if (requirement.tradeAtPort && (state.trade[requirement.tradeAtPort.portId] ?? 0) < requirement.tradeAtPort.min) return false;
  return true;
}

function fulfillRequirement(state, requirement) {
  if (!requirement) return;
  for (const item of requirement.cargo ?? []) state.cargo[item.goodId] = Math.max(state.cargo[item.goodId] ?? 0, item.qty);
  for (const id of requirement.discoveredExplorationPoints ?? []) state.points.add(id);
  for (const id of requirement.visitPorts ?? []) state.ports.add(id);
  if (requirement.tradeAtPort) state.trade[requirement.tradeAtPort.portId] = requirement.tradeAtPort.min;
}

const simulationLines = [];
for (const hero of story.heroes) {
  const chapters = story.chapters.filter((chapter) => chapter.heroId === hero.id).sort((a, b) => a.chapter - b.chapter);
  const state = { cargo: {}, points: new Set(), ports: new Set([hero.startPortId]), trade: {} };
  let completedStages = 0;
  for (const chapter of chapters) {
    for (const stage of chapter.stages ?? []) {
      if (stage.duel) {
        completedStages += 1;
        continue;
      }
      fulfillRequirement(state, stage.requirement);
      if (!requirementMet(state, stage.requirement)) error(chapter, '自動通關無法完成中途任務「' + stage.title + '」');
      completedStages += 1;
    }
    fulfillRequirement(state, chapter.requirements);
    if (!requirementMet(state, chapter.requirements)) error(chapter, '自動通關無法完成章節既有條件');
    state.ports.add(chapter.targetPortId);
  }
  if (chapters.length !== 10) errors.push('[' + hero.id + '] 主線章節應為 10，實際 ' + chapters.length);
  simulationLines.push(hero.id + ' ' + chapters.length + '/10章・' + completedStages + '任務');
}
console.log('主角 ' + story.heroes.length + ' 位｜章節 ' + story.chapters.length + ' 章｜中途任務 ' + stageCount + ' 個');
console.log('自動通關：' + simulationLines.join('｜'));
if (errors.length) {
  console.error('\n✖ 錯誤 ' + errors.length + ' 筆：');
  for (const message of errors) console.error('  ' + message);
  process.exit(1);
}
console.log('\n✅ 主線資料完整性檢查通過');