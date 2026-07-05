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

console.log('主角 ' + story.heroes.length + ' 位｜章節 ' + story.chapters.length + ' 章｜中途任務 ' + stageCount + ' 個');
if (errors.length) {
  console.error('\n✖ 錯誤 ' + errors.length + ' 筆：');
  for (const message of errors) console.error('  ' + message);
  process.exit(1);
}
console.log('\n✅ 主線資料完整性檢查通過');