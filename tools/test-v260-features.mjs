// Usage: node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-v260-features.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapsData from '../src/data/battleMaps.json';
import { offsetToAxial, hexDistance, hexEqual } from '../src/battle/hex.ts';
import { broadsideArcHexes, validateCannonAttack } from '../src/battle/battleRules.ts';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};

const stateMod = await import('../src/state.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cases = 0;
const test = (name, run) => { run(); cases += 1; console.log('ok ' + name); };

const makeUnit = (hex, facing, cannonTypeId = 'standard', cannons = 4) => ({
  id: 'p0',
  side: 'player',
  shipTypeId: 'fuchuan',
  shipSize: 'medium',
  flagship: true,
  hex,
  facing,
  hull: 100,
  hullMax: 100,
  crew: 40,
  crewMax: 40,
  cannons,
  cannonTypeId,
  cannonPower: 1,
  gunnerMod: 1,
  armorMultiplier: 1,
  boardingBonus: 0,
  crewLossMultiplier: 1,
  movePoints: 4,
  moveSpent: 0,
  moved: false,
  acted: false,
  repairedTotal: 0,
  status: 'active',
});

test('broadsideArcHexes 與 validateCannonAttack 完全一致，且正確處理紅夷砲最小射程 2 與散彈砲射程 1', () => {
  const openSea = mapsData.maps.find((m) => m.id === 'open_sea');
  const origin = offsetToAxial(5, 3);

  // 標準砲（射程 1~2）
  const stdUnit = makeUnit(origin, 0, 'standard', 4);
  const stdArc = broadsideArcHexes(openSea, stdUnit);
  assert.ok(stdArc.length > 0);
  for (const hex of stdArc) {
    const dummyTarget = makeUnit(hex, 3, 'standard', 1);
    dummyTarget.side = 'enemy';
    assert.equal(validateCannonAttack(openSea, stdUnit, dummyTarget).ok, true);
  }

  // 紅夷砲（射程 2~3，貼身距離 1 格不可出現在射界中）
  const hongyi = makeUnit(origin, 0, 'ct_hongyi', 4);
  const hongyiArc = broadsideArcHexes(openSea, hongyi);
  assert.ok(hongyiArc.length > 0);
  assert.ok(hongyiArc.every((h) => hexDistance(origin, h) >= 2 && hexDistance(origin, h) <= 3));

  // 散彈砲（射程 1~1）
  const scatter = makeUnit(origin, 0, 'ct_scatter', 4);
  const scatterArc = broadsideArcHexes(openSea, scatter);
  assert.equal(scatterArc.length, 4, '空曠海域 6 鄰居中排除船首與船尾剩 4 格側舷');
  assert.ok(scatterArc.every((h) => hexDistance(origin, h) === 1));

  // 無大砲時射界為空
  const noGuns = makeUnit(origin, 0, 'standard', 0);
  assert.deepEqual(broadsideArcHexes(openSea, noGuns), []);
});

test('broadsideArcHexes 會排除島嶼與被島嶼遮蔽的格子', () => {
  const straits = mapsData.maps.find((m) => (m.terrain ?? []).some((t) => t.terrain === 'land')) ?? mapsData.maps[1] ?? mapsData.maps[0];
  const origin = offsetToAxial(4, 3);
  const unit = makeUnit(origin, 1, 'ct_hongyi', 4);
  const arc = broadsideArcHexes(straits, unit);
  for (const hex of arc) {
    const dummyTarget = makeUnit(hex, 4, 'standard', 1);
    dummyTarget.side = 'enemy';
    assert.equal(validateCannonAttack(straits, unit, dummyTarget).ok, true);
    assert.ok(!hexEqual(hex, origin));
  }
});

test('compassDirectionText 正確回報八方位與附近狀態', () => {
  assert.equal(stateMod.compassDirectionText(100, 100, 150, 130), '就在附近');
  assert.equal(stateMod.compassDirectionText(100, 100, 500, 100), '正東方');
  assert.equal(stateMod.compassDirectionText(100, 100, 100, 500), '正南方');
  assert.equal(stateMod.compassDirectionText(500, 100, 100, 100), '正西方');
  assert.equal(stateMod.compassDirectionText(100, 500, 100, 100), '正北方');
  assert.equal(stateMod.compassDirectionText(100, 100, 400, 400), '東南方');
  assert.equal(stateMod.compassDirectionText(400, 400, 100, 100), '西北方');
});

test('進港安全快照獨立於主存檔、刪除存檔同步清除、暫態預覽不寫入', () => {
  const s = stateMod.newGame('lin');
  s.gold = 5555;
  stateMod.saveGame(s, 1);
  assert.equal(stateMod.savePortSnapshot(s, 1), true);
  assert.equal(stateMod.hasPortSnapshot(1), true);

  // 模擬出海後資金大損並自動覆寫主存檔
  s.gold = 12;
  stateMod.saveGame(s, 1);
  assert.equal(stateMod.loadGame(1).gold, 12);
  // 進港安全快照仍保有安全進度
  assert.equal(stateMod.loadPortSnapshot(1).gold, 5555);

  // 暫態狀態不可寫入快照
  const preview = stateMod.markTransientGameState(stateMod.newGame('peter'));
  preview.gold = 999999;
  assert.equal(stateMod.savePortSnapshot(preview, 1), false);
  assert.equal(stateMod.loadPortSnapshot(1).gold, 5555);

  // 刪除存檔會連同快照清除
  stateMod.deleteSave(1);
  assert.equal(stateMod.hasPortSnapshot(1), false);
});

test('BootScene 開機不再預載廢棄 v2 地圖與探險事件圖', () => {
  const boot = fs.readFileSync(path.join(root, 'src/scenes/BootScene.ts'), 'utf8');
  assert.ok(!boot.includes('EXPLORATION_EVENT_URLS'), 'BootScene 不應開機預載探險事件圖');
  assert.ok(boot.includes("id.startsWith('full_map_v2')"), 'BootScene 應略過廢棄 v2 世界地圖預載');
});

console.log(`V2.6.0 features ${cases} cases passed`);
