import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DATA = new URL('../src/data/', import.meta.url);
const TERRAIN = new Set(['deep', 'shallow', 'land', 'reef']);
const EXPECTED_MAPS = ['open_sea', 'island_channel', 'reef_passage'];

const fail = (message) => {
  throw new Error(`❌ ${message}`);
};

const readJson = async (name) => {
  const text = await readFile(new URL(name, DATA), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${name} 不是合法 JSON：${error.message}`);
  }
};

const keyOf = ({ q, r }) => `${q},${r}`;
const assertHex = (hex, map, label) => {
  if (!Number.isInteger(hex?.q) || !Number.isInteger(hex?.r)) fail(`${map.id} ${label} 座標必須是整數`);
  if (hex.q < 0 || hex.q >= map.width || hex.r < 0 || hex.r >= map.height) {
    fail(`${map.id} ${label} 座標 ${keyOf(hex)} 超出 ${map.width}×${map.height} 邊界`);
  }
};

const mapsData = await readJson('battleMaps.json');
const rulesData = await readJson('battleRules.json');
const encountersData = await readJson('battleEncounters.json');

if (mapsData.version !== 1 || rulesData.version !== 1 || encountersData.version !== 1) fail('三份資料的 version 必須都是 1');
if (!Array.isArray(mapsData.maps) || mapsData.maps.length !== 3) fail('battleMaps.json 必須剛好有 3 張地圖');
if (!Array.isArray(encountersData.encounters)) fail('battleEncounters.json encounters 必須是陣列');
if (rulesData.maxRounds !== 12 || rulesData.defaultMapId !== 'open_sea') fail('battleRules.json 的回合上限或預設地圖不符規格');
if (rulesData.turnMode !== 'side') fail('battleRules.json turnMode 必須是 side');
for (const id of ['deep', 'shallow', 'land', 'reef']) {
  if (!rulesData.terrain?.[id] || typeof rulesData.terrain[id].passable !== 'boolean' || typeof rulesData.terrain[id].blocksLineOfSight !== 'boolean') fail(`battleRules.json terrain.${id} 缺少布林規則`);
}
for (const id of ['standard', 'ct_folang', 'ct_scatter', 'ct_hongyi']) {
  const cannon = rulesData.cannons?.[id];
  if (!cannon || !Number.isFinite(cannon.minRange) || !Number.isFinite(cannon.maxRange) || !Number.isFinite(cannon.power) || cannon.minRange > cannon.maxRange) fail(`battleRules.json cannons.${id} 無效`);
}
for (const path of [
  ['movement', 'deepCost'], ['movement', 'shallowCost'], ['movement', 'shallowLargeCost'], ['movement', 'turnCost'],
  ['damage', 'basePerCannon'], ['damage', 'randomMin'], ['damage', 'randomMax'], ['boarding', 'decisiveRatio'],
  ['repair', 'hullPercent'], ['repair', 'minimum'], ['repair', 'maximum'],
]) {
  if (!Number.isFinite(rulesData[path[0]]?.[path[1]])) fail(`battleRules.json ${path.join('.')} 必須是數字`);
}

const ids = mapsData.maps.map((map) => map.id);
if (new Set(ids).size !== ids.length) fail('地圖 id 不得重複');
if (EXPECTED_MAPS.some((id) => !ids.includes(id))) fail(`地圖 id 必須包含 ${EXPECTED_MAPS.join('、')}`);

for (const map of mapsData.maps) {
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width !== 11 || map.height !== 7) {
    fail(`${map.id} 第一版尺寸必須是 11×7`);
  }
  if (!TERRAIN.has(map.defaultTerrain)) fail(`${map.id} defaultTerrain 無效`);
  if (!Array.isArray(map.terrain)) fail(`${map.id} terrain 必須是陣列`);

  const terrainByHex = new Map();
  for (const cell of map.terrain) {
    assertHex(cell, map, 'terrain');
    if (!TERRAIN.has(cell.terrain)) fail(`${map.id} ${keyOf(cell)} terrain 無效`);
    const key = keyOf(cell);
    if (terrainByHex.has(key)) fail(`${map.id} terrain 格座標重複：${key}`);
    terrainByHex.set(key, cell.terrain);
  }

  const occupiedDeployments = new Set();
  for (const side of ['player', 'enemy']) {
    const cells = map.deployments?.[side];
    if (!Array.isArray(cells) || cells.length < 1 || cells.length > 5) fail(`${map.id} ${side} 部署格必須有 1～5 格`);
    for (const hex of cells) {
      assertHex(hex, map, `${side} deployment`);
      const key = keyOf(hex);
      if (occupiedDeployments.has(key)) fail(`${map.id} 部署格重複：${key}`);
      occupiedDeployments.add(key);
      const terrain = terrainByHex.get(key) ?? map.defaultTerrain;
      if (terrain === 'land' || terrain === 'reef') fail(`${map.id} ${side} 部署格 ${key} 不可位於 ${terrain}`);
      if (side === 'player' && hex.q > 1) fail(`${map.id} 玩家部署格必須在左側 2 欄`);
      if (side === 'enemy' && hex.q < map.width - 2) fail(`${map.id} 敵方部署格必須在右側 2 欄`);
    }
  }

  if (map.retreatEdges?.player !== 'west' || map.retreatEdges?.enemy !== 'east') {
    fail(`${map.id} 撤退邊界必須是玩家 west、敵方 east`);
  }
}

const mainSource = await readFile(new URL('src/main.ts', ROOT), 'utf8');
const configSource = await readFile(new URL('src/battle/battleConfig.ts', ROOT), 'utf8');
const pureSources = await Promise.all([
  'src/battle/hex.ts',
  'src/battle/battleRules.ts',
  'src/battle/battleEngine.ts',
].map(async (path) => [path, await readFile(new URL(path, ROOT), 'utf8')]));
if (mainSource.includes('BattleHexScene') || mainSource.includes("'BattleHex'")) fail('P0 不得註冊 BattleHexScene');
if (!/USE_HEX_BATTLE\s*=\s*false/.test(configSource)) fail('P0 功能旗標必須維持 false');
for (const [path, source] of pureSources) {
  if (/from\s+['"]phaser['"]|import\s+Phaser/i.test(source)) fail(`${path} 不得 import Phaser`);
  if (/Math\.random\s*\(/.test(source)) fail(`${path} 不得直接使用 Math.random()`);
}

console.log(`地圖 ${mapsData.maps.length} 張｜id 唯一｜地形格 ${mapsData.maps.reduce((sum, map) => sum + map.terrain.length, 0)} 格｜部署格 ${mapsData.maps.reduce((sum, map) => sum + map.deployments.player.length + map.deployments.enemy.length, 0)} 格`);
console.log('正式流程：BattleHexScene 未註冊｜USE_HEX_BATTLE=false');
console.log('純規則：hex／rules／engine 未依賴 Phaser，未直接使用 Math.random()');
console.log('\n✅ P0 六角格海戰資料與型別骨架檢查通過');
