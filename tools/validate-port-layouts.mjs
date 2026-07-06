import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const layoutsData = readJson('src/data/portTownLayouts.json');
const themesData = readJson('src/data/portTownThemes.json');
const portsData = readJson('src/data/ports.json');
const BG_DIR = path.join(ROOT, 'assets/m5/v2/m5-2/ports/town-backgrounds');
const REQUIRED = ['trade', 'tavern', 'inn', 'office', 'item', 'shipyard', 'harbor'];
const errors = [];
const fail = (scope, message) => errors.push(`[${scope}] ${message}`);
const inBounds = (point, canvas) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
  && point.x >= 0 && point.x <= canvas.w && point.y >= 0 && point.y <= canvas.h;
const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
const isWalkable = (point, polygons) => polygons.some((polygon) => pointInPolygon(point, polygon));
const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const segmentsCross = (a, b, c, d) => orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
const polygonsTouch = (a, b) => a.some((point) => pointInPolygon(point, b))
  || b.some((point) => pointInPolygon(point, a))
  || a.some((p1, i) => b.some((p2, j) => segmentsCross(p1, a[(i + 1) % a.length], p2, b[(j + 1) % b.length])));
const connectedPolygons = (polygons, startPoint) => {
  const reached = new Set(polygons.map((polygon, index) => pointInPolygon(startPoint, polygon) ? index : -1).filter((index) => index >= 0));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < polygons.length; i += 1) {
      if (reached.has(i)) continue;
      if ([...reached].some((j) => polygonsTouch(polygons[i], polygons[j]))) {
        reached.add(i);
        changed = true;
      }
    }
  }
  return reached;
};

const canvas = layoutsData.canvas;
if (!(canvas?.w > 0 && canvas?.h > 0)) fail('global', 'canvas 尺寸無效');
const layouts = layoutsData.layouts ?? {};
for (const [themeId, layout] of Object.entries(layouts)) {
  if (layout.themeId !== themeId) fail(themeId, 'themeId 與索引鍵不一致');
  if (!fs.existsSync(path.join(BG_DIR, `${layout.bgKey}.png`))) fail(themeId, `找不到底圖 ${layout.bgKey}.png`);
  if (!Array.isArray(layout.walkable) || !layout.walkable.length) fail(themeId, '缺 walkable 多邊形');
  for (const [index, polygon] of (layout.walkable ?? []).entries()) {
    if (!Array.isArray(polygon) || polygon.length < 3) fail(themeId, `walkable[${index}] 少於 3 點`);
    for (const point of polygon ?? []) if (!inBounds(point, canvas)) fail(themeId, `walkable[${index}] 有點超出畫布`);
  }
  const facilities = layout.facilities ?? [];
  const keys = facilities.map((item) => item.key);
  for (const key of REQUIRED) if (keys.filter((item) => item === key).length !== 1) fail(themeId, `設施 ${key} 必須剛好一筆`);
  if (facilities.length !== REQUIRED.length) fail(themeId, `設施應為 7 筆，實際 ${facilities.length}`);
  for (const facility of facilities) {
    for (const field of ['x','y','w','h','doorX','doorY']) {
      if (!Number.isFinite(facility[field])) fail(themeId, `${facility.key} 缺數值欄位 ${field}`);
    }
    if (!(facility.w > 0 && facility.h > 0)) fail(themeId, `${facility.key} 尺寸必須大於 0`);
    if (!inBounds({x:facility.x,y:facility.y}, canvas)) fail(themeId, `${facility.key} 中心超出畫布`);
    const door = {x:facility.doorX,y:facility.doorY};
    if (!inBounds(door, canvas)) fail(themeId, `${facility.key} 門點超出畫布`);
    else if (!isWalkable(door, layout.walkable ?? [])) fail(themeId, `${facility.key} 門點不在可走區域`);
  }
  if (!inBounds(layout.spawn, canvas)) fail(themeId, 'spawn 超出畫布');
  else if (!isWalkable(layout.spawn, layout.walkable ?? [])) fail(themeId, 'spawn 不在可走區域');
  if (!layout.labelStyle?.text || !Number.isFinite(layout.labelStyle?.background)) fail(themeId, 'labelStyle 不完整');
  const reached = connectedPolygons(layout.walkable ?? [], layout.spawn);
  for (const facility of facilities) {
    const door = { x: facility.doorX, y: facility.doorY };
    const doorPolygons = (layout.walkable ?? []).map((polygon, index) => pointInPolygon(door, polygon) ? index : -1).filter((index) => index >= 0);
    if (!doorPolygons.some((index) => reached.has(index))) fail(themeId, facility.key + ' 門點無法從 spawn 的可走區連通');
  }
}

const portIds = new Set(portsData.ports.map((port) => port.id));
const mappedIds = new Set(Object.keys(themesData.ports ?? {}));
for (const id of portIds) {
  const themeId = themesData.ports?.[id];
  if (!themeId) fail(id, '未指定港町主題');
  else if (!layouts[themeId]) fail(id, `指定了不存在的主題 ${themeId}`);
  else {
    const port = portsData.ports.find((item) => item.id === id);
    const runtimeCount = layouts[themeId].facilities.filter((facility) => facility.key !== 'shipyard' || port?.shipyard).length;
    const expectedCount = port?.shipyard ? 7 : 6;
    if (runtimeCount !== expectedCount) fail(id, '執行時設施應為 ' + expectedCount + '，實際 ' + runtimeCount);
  }
}
for (const id of mappedIds) if (!portIds.has(id)) fail(id, '主題表含未知港口');
if (mappedIds.size !== portIds.size) fail('global', `港口主題數 ${mappedIds.size} 與港口數 ${portIds.size} 不一致`);

console.log(`主題 ${Object.keys(layouts).length} 個｜港口 ${portIds.size} 個｜每主題 7 設施`);
if (errors.length) {
  console.error(`\n✖ 港町 layout 錯誤 ${errors.length} 筆：`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('\n✅ 港町 layout 資料檢查通過');