import { TownNavigator } from './navigation';
import type { TownFacilityKey, TownGroundPoint, TownSceneData } from './types';

const FACILITY_KEYS: TownFacilityKey[] = ['trade', 'tavern', 'inn', 'office', 'item', 'shipyard', 'harbor'];
const AMBIENCE_KINDS = new Set(['water', 'flag', 'foliage', 'smoke', 'npc']);
const OCCLUSION_MODES = new Set(['solid', 'fade', 'none']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pointValid(value: unknown): value is TownGroundPoint {
  return isRecord(value) && isFiniteNumber(value.u) && isFiniteNumber(value.v);
}

function polygonArea(points: TownGroundPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    twiceArea += a.u * b.v - b.u * a.v;
  }
  return twiceArea / 2;
}

function orientation(a: TownGroundPoint, b: TownGroundPoint, c: TownGroundPoint): number {
  return Math.sign((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u));
}

function segmentsCross(a: TownGroundPoint, b: TownGroundPoint, c: TownGroundPoint, d: TownGroundPoint): boolean {
  return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
}

function polygonSelfIntersects(points: TownGroundPoint[]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (segmentsCross(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function checkUnique(values: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) errors.push(`${label} 不可為空`);
    if (seen.has(value)) errors.push(`${label} 重複：${value}`);
    seen.add(value);
  }
}

export function validateTownSceneData(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ['根節點必須是物件'];
  if (raw.schemaVersion !== 1) errors.push('schemaVersion 必須為 1');
  if (typeof raw.id !== 'string' || !raw.id) errors.push('id 必須是非空字串');
  if (typeof raw.themeId !== 'string' || !raw.themeId) errors.push('themeId 必須是非空字串');
  if (typeof raw.layoutRevision !== 'string' || !raw.layoutRevision) errors.push('layoutRevision 必須是非空字串');

  if (!isRecord(raw.world)) errors.push('world 必須是物件');
  else {
    for (const key of ['width', 'height', 'unitsToWorld', 'playerRadius', 'navigationStep']) {
      if (!isFiniteNumber(raw.world[key]) || (raw.world[key] as number) <= 0) errors.push(`world.${key} 必須是正有限數`);
    }
  }
  if (!isRecord(raw.camera)) errors.push('camera 必須是物件');
  else {
    if (raw.camera.projection !== 'orthographic') errors.push('camera.projection 必須是 orthographic');
    for (const key of ['pitchDeg', 'yawDeg', 'viewSpan']) {
      if (!isFiniteNumber(raw.camera[key])) errors.push(`camera.${key} 必須是有限數`);
    }
  }
  if (!isRecord(raw.surfaces)) errors.push('surfaces 必須是物件');
  else {
    if (typeof raw.surfaces.groundAssetId !== 'string' || !raw.surfaces.groundAssetId) errors.push('surfaces.groundAssetId 必須是非空字串');
    if (typeof raw.surfaces.waterAssetId !== 'string' || !raw.surfaces.waterAssetId) errors.push('surfaces.waterAssetId 必須是非空字串');
  }
  if (!pointValid(raw.spawn)) errors.push('spawn 必須是有限座標');

  const polygons: TownGroundPoint[][] = [];
  if (!Array.isArray(raw.walkable) || raw.walkable.length === 0) errors.push('walkable 至少需要一個 polygon');
  else for (const [index, polygon] of raw.walkable.entries()) {
    if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(pointValid)) {
      errors.push(`walkable[${index}] 不是合法 polygon`);
      continue;
    }
    polygons.push(polygon);
    if (Math.abs(polygonArea(polygon)) < 1e-6 || polygonSelfIntersects(polygon)) errors.push(`walkable[${index}] 面積為零或自相交`);
  }

  const obstacles = Array.isArray(raw.obstacles) ? raw.obstacles : [];
  if (!Array.isArray(raw.obstacles)) errors.push('obstacles 必須是陣列');
  const obstacleIds: string[] = [];
  for (const [index, obstacle] of obstacles.entries()) {
    if (!isRecord(obstacle) || typeof obstacle.id !== 'string') {
      errors.push(`obstacles[${index}] 格式錯誤`);
      continue;
    }
    obstacleIds.push(obstacle.id);
    if (!Array.isArray(obstacle.polygon) || obstacle.polygon.length < 3 || !obstacle.polygon.every(pointValid)) {
      errors.push(`obstacles[${index}].polygon 不合法`);
    } else if (Math.abs(polygonArea(obstacle.polygon)) < 1e-6 || polygonSelfIntersects(obstacle.polygon)) {
      errors.push(`obstacles[${index}].polygon 面積為零或自相交`);
    }
  }
  checkUnique(obstacleIds, 'obstacle id', errors);

  const objects = Array.isArray(raw.objects) ? raw.objects : [];
  if (!Array.isArray(raw.objects)) errors.push('objects 必須是陣列');
  const objectIds: string[] = [];
  for (const [index, object] of objects.entries()) {
    if (!isRecord(object) || typeof object.id !== 'string' || typeof object.assetId !== 'string' || !pointValid(object.at)) {
      errors.push(`objects[${index}] 格式錯誤`);
      continue;
    }
    objectIds.push(object.id);
    if (![object.elevation, object.scale, object.rotationDeg].every(isFiniteNumber)) errors.push(`objects[${index}] 數值必須有限`);
    if (!OCCLUSION_MODES.has(String(object.occlusion))) errors.push(`objects[${index}].occlusion 不合法`);
  }
  checkUnique(objectIds, 'object id', errors);
  const objectIdSet = new Set(objectIds);

  const facilities = Array.isArray(raw.facilities) ? raw.facilities : [];
  if (!Array.isArray(raw.facilities)) errors.push('facilities 必須是陣列');
  const facilityKeys: string[] = [];
  for (const [index, facility] of facilities.entries()) {
    if (!isRecord(facility) || typeof facility.key !== 'string' || typeof facility.label !== 'string' || typeof facility.objectId !== 'string') {
      errors.push(`facilities[${index}] 格式錯誤`);
      continue;
    }
    facilityKeys.push(facility.key);
    if (!FACILITY_KEYS.includes(facility.key as TownFacilityKey)) errors.push(`facilities[${index}].key 不合法`);
    if (!objectIdSet.has(facility.objectId)) errors.push(`facilities[${index}] 引用不存在的 objectId：${facility.objectId}`);
    if (!pointValid(facility.door) || !pointValid(facility.approach)) errors.push(`facilities[${index}] 門點座標不合法`);
    if (!isFiniteNumber(facility.interactionRadius) || facility.interactionRadius <= 0) errors.push(`facilities[${index}].interactionRadius 必須為正數`);
  }
  checkUnique(facilityKeys, 'facility key', errors);
  for (const key of FACILITY_KEYS) if (!facilityKeys.includes(key)) errors.push(`缺少設施：${key}`);

  const ambience = Array.isArray(raw.ambience) ? raw.ambience : [];
  if (!Array.isArray(raw.ambience)) errors.push('ambience 必須是陣列');
  const ambienceIds: string[] = [];
  for (const [index, item] of ambience.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.objectId !== 'string') {
      errors.push(`ambience[${index}] 格式錯誤`);
      continue;
    }
    ambienceIds.push(item.id);
    if (!AMBIENCE_KINDS.has(String(item.kind))) errors.push(`ambience[${index}].kind 不合法`);
    if (!objectIdSet.has(item.objectId)) errors.push(`ambience[${index}] 引用不存在的 objectId：${item.objectId}`);
    if (!Number.isInteger(item.seed)) errors.push(`ambience[${index}].seed 必須是整數`);
  }
  checkUnique(ambienceIds, 'ambience id', errors);

  if (errors.length === 0) {
    const data = raw as unknown as TownSceneData;
    try {
      const navigator = new TownNavigator(data);
      if (!navigator.isNavigable(data.spawn)) errors.push('spawn 扣除角色半徑後不可通行');
      for (const facility of data.facilities) {
        if (!navigator.isNavigable(facility.door)) errors.push(`${facility.key} door 扣除角色半徑後不可通行`);
        if (!navigator.isNavigable(facility.approach)) errors.push(`${facility.key} approach 扣除角色半徑後不可通行`);
        if (!navigator.findPath(data.spawn, facility.approach)) errors.push(`${facility.key} 從出生點不可達`);
      }
    } catch (error) {
      errors.push(`導航資料無法建立：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

export function parseTownScene(text: string): TownSceneData {
  const raw: unknown = JSON.parse(text);
  const errors = validateTownSceneData(raw);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return raw as TownSceneData;
}

export function serializeTownScene(data: TownSceneData): string {
  const errors = validateTownSceneData(data);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return `${JSON.stringify(data, null, 2)}\n`;
}
