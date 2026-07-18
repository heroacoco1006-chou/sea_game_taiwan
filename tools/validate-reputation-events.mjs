import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', file), 'utf8'));
const events = read('reputationEvents.json').events;
const equipment = read('equipment.json');
const ports = new Set(read('ports.json').ports.map((row) => row.id));
const goods = new Set(read('goods.json').goods.map((row) => row.id));
const explorationPoints = new Set(read('exploration_points.json').points.map((row) => row.id));
const codex = new Set(read('codex.json').entries.map((row) => row.id));
const encounters = read('battleEncounters.json').encounters;
const stateSource = fs.readFileSync(path.join(root, 'src', 'state.ts'), 'utf8');
const shopFunction = stateSource.match(/export function shopItemIdsForPort[\s\S]+?return Object\.fromEntries/)?.[0] ?? '';
const equipmentRows = [...equipment.weapons, ...equipment.accessories];

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const eventIds = new Set(events.map((event) => event.id));

assert(events.length === 6, `特殊事件應為 6 個，目前 ${events.length} 個。`);
assert(eventIds.size === events.length, '特殊事件 id 有重複。');
for (const kind of ['adventure', 'trade', 'valor']) {
  const thresholds = events.filter((event) => event.kind === kind).map((event) => event.threshold).sort((a, b) => a - b);
  assert(JSON.stringify(thresholds) === '[40,80]', `${kind} 應各有 40、80 兩階事件。`);
}

for (const event of events) {
  assert(ports.has(event.startPortId), `${event.id} 起始港不存在：${event.startPortId}`);
  assert(ports.has(event.completionPortId), `${event.id} 完成港不存在：${event.completionPortId}`);
  assert(event.introLines?.length > 0 && event.conclusionLines?.length > 0, `${event.id} 缺開場或結局文本。`);
  assert(event.stages?.length > 0, `${event.id} 沒有事件階段。`);
  if (event.prerequisiteEventId) assert(eventIds.has(event.prerequisiteEventId), `${event.id} 前置事件不存在。`);
  for (const stage of event.stages ?? []) {
    if (stage.reportAtPortId) assert(ports.has(stage.reportAtPortId), `${event.id} 回報港不存在：${stage.reportAtPortId}`);
    for (const cargo of stage.requirement?.cargo ?? []) assert(goods.has(cargo.goodId), `${event.id} 商品不存在：${cargo.goodId}`);
    for (const pointId of stage.requirement?.discoveredExplorationPoints ?? []) {
      assert(explorationPoints.has(pointId), `${event.id} 探索點不存在：${pointId}`);
    }
    if (stage.duel) {
      assert(encounters.some((row) => row.kind === 'reputation' && row.matchNames?.includes(stage.duel.name)), `${event.id} 找不到具名海戰：${stage.duel.name}`);
    }
  }
  for (const codexId of event.rewards.codexIds ?? []) assert(codex.has(codexId), `${event.id} 圖鑑不存在：${codexId}`);
  assert(event.rewards.codexIds?.includes(event.codexEntry.id), `${event.id} 獎勵未包含自己的圖鑑 id。`);
  if (event.rewards.itemId) {
    const item = equipmentRows.find((row) => row.id === event.rewards.itemId);
    assert(item?.rare === true, `${event.id} 稀有獎勵不存在或未標 rare：${event.rewards.itemId}`);
    assert(!shopFunction.includes(`'${event.rewards.itemId}'`), `${event.rewards.itemId} 不可出現在商店庫存。`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log('聲望特殊事件驗證通過：6 事件、3 稀有道具、港口／商品／探索／海戰／圖鑑引用皆有效。');
