import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(root, 'assets/m5/v2/battle-hex');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'battle-hex-assets.json'), 'utf8'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const pngSize = (file) => {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(1, 4).toString('ascii');
  assert(signature === 'PNG', `${path.relative(root, file)} 不是 PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

const runtimeFiles = new Set();
const verifyAsset = (entry, group) => {
  const absolute = path.join(packRoot, entry.path);
  assert(fs.existsSync(absolute), `${group}/${entry.id} 缺少檔案 ${entry.path}`);
  if (!fs.existsSync(absolute)) return;
  runtimeFiles.add(absolute);
  const actual = pngSize(absolute);
  assert(actual[0] === entry.size[0] && actual[1] === entry.size[1],
    `${entry.path} 尺寸應為 ${entry.size.join('x')}，實際 ${actual.join('x')}`);
};

assert(manifest.status === 'final', `素材 manifest 狀態應為 final，實際 ${manifest.status}`);
const expectedCounts = { ships: 8, terrain: 3, islands: 6, effects: 6, commands: 8, overlays: 6, markers: 7 };
for (const [group, count] of Object.entries(expectedCounts)) {
  assert(Array.isArray(manifest[group]) && manifest[group].length === count,
    `${group} 預期 ${count} 筆，實際 ${manifest[group]?.length ?? 0}`);
}

const directions = ['east', 'southeast', 'southwest', 'west', 'northwest', 'northeast'];
for (const ship of manifest.ships) {
  assert(ship.frames.length === 6, `${ship.id} 應有 6 張方向 frame`);
  assert(JSON.stringify(ship.directions) === JSON.stringify(directions), `${ship.id} 六方向順序不符`);
  ship.frames.forEach((relative) => {
    const absolute = path.join(packRoot, relative);
    assert(fs.existsSync(absolute), `${ship.id} 缺少 ${relative}`);
    if (!fs.existsSync(absolute)) return;
    runtimeFiles.add(absolute);
    const actual = pngSize(absolute);
    assert(actual[0] === ship.frameSize[0] && actual[1] === ship.frameSize[1], `${relative} frame 尺寸不符`);
  });
  const sheet = path.join(packRoot, ship.sheet);
  assert(fs.existsSync(sheet), `${ship.id} 缺少 spritesheet`);
  if (fs.existsSync(sheet)) {
    runtimeFiles.add(sheet);
    const actual = pngSize(sheet);
    assert(actual[0] === ship.frameSize[0] * 6 && actual[1] === ship.frameSize[1], `${ship.sheet} sheet 尺寸不符`);
  }
}

for (const group of ['terrain', 'islands', 'effects', 'commands', 'overlays', 'markers']) {
  for (const entry of manifest[group]) verifyAsset(entry, group);
}

const idsUnique = (items) => new Set(items.map((item) => item.id)).size === items.length;
for (const group of Object.keys(expectedCounts)) assert(idsUnique(manifest[group]), `${group} id 有重複`);

const scene = read('src/scenes/BattleHexScene.ts');
const battleArt = read('src/battle/battleArt.ts');
const boot = read('src/scenes/BootScene.ts');
const config = read('src/battle/battleConfig.ts');
for (const token of [
  'preload(): void', 'BATTLE_HEX_SHIP_SHEET_URLS', 'BATTLE_HEX_TERRAIN_URLS',
  'battleHexShipKey', 'battleHexOverlayKey', 'battleHexMarkerKey', 'battleHexEffectKey',
  "effectArt(event.attackerId, 'cannon_flash'", "effectArt(event.targetId, 'boarding_hooks'",
  "this.addOverlayArt('move'", "this.addMarkerArt('route_dot'", 'this.btnRetreat.setVisible(actionReady)',
  'renderHeadingIndicator', '0x00ff2a', '船首朝向',
]) assert(scene.includes(token), `BattleHexScene 缺少 P8 接線：${token}`);
assert(scene.includes('任一船圖缺失時維持可辨識的程序船體'), 'BattleHexScene 缺少船隻 fallback');
assert(scene.includes('if (!this.textures.exists(key))'), 'BattleHexScene 缺少材質快取防重載');
for (const token of ['import.meta.glob', 'BATTLE_HEX_COMMAND_URLS', 'BATTLE_HEX_EFFECT_URLS', 'BATTLE_HEX_MARKER_URLS']) {
  assert(battleArt.includes(token), `battleArt.ts 缺少 ${token}`);
}
assert(!boot.includes('BATTLE_HEX_'), 'BootScene 不應預載 P8 海戰素材');
assert(/USE_HEX_BATTLE\s*=\s*false/.test(config), 'P9 完整驗收前 USE_HEX_BATTLE 必須維持 false');

const loadedFiles = [...runtimeFiles].filter((file) => !file.includes(`${path.sep}frames${path.sep}`));
const totalBytes = loadedFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`P8 素材：${manifest.ships.length} 船型 × 6 方向｜地形 ${manifest.terrain.length}｜島嶼 ${manifest.islands.length}｜特效 ${manifest.effects.length}｜指令 ${manifest.commands.length}`);
console.log(`覆蓋圖 ${manifest.overlays.length}｜標記 ${manifest.markers.length}｜runtime ${(totalBytes / 1024 / 1024).toFixed(2)} MB｜Boot 預載 0`);
if (errors.length) {
  console.error(`\n✖ P8 美術素材檢查失敗 ${errors.length} 筆：`);
  errors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}
console.log('\n✅ P8 六角格海戰素材、尺寸、接線、fallback 與延遲載入檢查通過');
