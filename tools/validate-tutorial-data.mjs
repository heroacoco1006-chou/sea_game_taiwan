import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'src', 'data', 'tutorial.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const errors = [];
const allowedKinds = new Set(['core', 'context']);
const allowedPresentations = new Set(['modal', 'action']);
const allowedScenes = new Set([
  'WorldMap', 'Port', 'Trade', 'Facility', 'BattleHex', 'Mates', 'Info',
]);
const allowedEvents = new Set([
  'tutorial_start',
  'tutorial_continue',
  'port_entered',
  'town_moved',
  'trade_opened',
  'trade_bought',
  'trade_sell_available',
  'trade_sold',
  'harbor_opened',
  'world_departed',
  'world_moved',
  'office_opened',
  'quest_accepted',
  'battle_started',
  'battle_command_completed',
  'mates_opened',
  'mate_detail_opened',
  'codex_available',
  'codex_entry_opened',
]);

if (data.schemaVersion !== 1) errors.push('schemaVersion 必須為 1');
if (!Array.isArray(data.modules) || data.modules.length === 0) errors.push('modules 不可為空');
if (!Array.isArray(data.manualTopics) || data.manualTopics.length === 0) errors.push('manualTopics 不可為空');

const moduleIds = new Set();
const stepIds = new Set();
let coreCount = 0;

for (const module of data.modules ?? []) {
  if (!module.id || moduleIds.has(module.id)) errors.push(`模組 id 缺漏或重複：${module.id}`);
  moduleIds.add(module.id);
  if (!allowedKinds.has(module.kind)) errors.push(`${module.id} kind 不合法：${module.kind}`);
  if (module.kind === 'core') coreCount += 1;
  if (module.kind === 'context' && !allowedEvents.has(module.triggerEvent)) {
    errors.push(`${module.id} triggerEvent 不合法：${module.triggerEvent}`);
  }
  if (!Array.isArray(module.steps) || module.steps.length === 0) errors.push(`${module.id} steps 不可為空`);

  for (const step of module.steps ?? []) {
    if (!step.id || stepIds.has(step.id)) errors.push(`步驟 id 缺漏或重複：${step.id}`);
    stepIds.add(step.id);
    if (!allowedScenes.has(step.scene)) errors.push(`${step.id} scene 不合法：${step.scene}`);
    if (!allowedPresentations.has(step.presentation)) errors.push(`${step.id} presentation 不合法`);
    if (!step.title?.trim()) errors.push(`${step.id} 缺少 title`);
    if (!step.body?.desktop?.trim() || !step.body?.touch?.trim()) errors.push(`${step.id} 缺少桌面或觸控文字`);
    if (!allowedEvents.has(step.completeOn?.event)) errors.push(`${step.id} completeOn.event 不合法：${step.completeOn?.event}`);
    if (typeof step.canSkip !== 'boolean') errors.push(`${step.id} canSkip 必須為布林值`);
  }
}

if (coreCount !== 1 || !moduleIds.has('core')) errors.push('必須且只能有一個 id=core 的核心模組');

const topicIds = new Set();
for (const topic of data.manualTopics ?? []) {
  if (!topic.id || topicIds.has(topic.id)) errors.push(`手冊主題 id 缺漏或重複：${topic.id}`);
  topicIds.add(topic.id);
  if (!topic.title?.trim() || !topic.body?.trim()) errors.push(`手冊主題 ${topic.id} 缺少文字`);
}

if (errors.length) {
  console.error(`tutorial data validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`tutorial data validation passed: ${data.modules.length} modules, ${stepIds.size} steps, ${topicIds.size} manual topics`);
