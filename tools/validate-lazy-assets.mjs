import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const boot = read('src/scenes/BootScene.ts');
const story = read('src/scenes/StoryScene.ts');
const info = read('src/scenes/InfoScene.ts');
const port = read('src/scenes/PortScene.ts');
const worldMap = read('src/scenes/WorldMapScene.ts');
const shipyard = read('src/scenes/ShipyardScene.ts');
const battle = read('src/scenes/BattleScene.ts');
const art = read('src/art.ts');
const errors = [];

if (/STORY_CHAPTER_BG_BY_KEY/.test(boot)) errors.push('BootScene 仍引用全章節背景 manifest');
if (!/preload\(\): void/.test(story)) errors.push('StoryScene 缺少 preload()');
if (!/storyChapterBgUrl\(this\.heroId, this\.chapterNo\)/.test(story)) errors.push('StoryScene 未依主角／章節取得單張 URL');
if (!/!this\.textures\.exists\(key\)/.test(story)) errors.push('StoryScene 缺少材質快取防重載');
if (!/STORY_CHAPTER_BG_BY_KEY\[storyChapterBgKey\(heroId, chapter\)\]/.test(art)) errors.push('art.ts 缺少單章 URL lookup');

if (/CODEX_ILLUSTRATION_URLS/.test(boot)) errors.push('BootScene 仍引用全圖鑑插圖 manifest');
if (!/codexIllustrationUrl\(id\)/.test(info)) errors.push('InfoScene 未依圖鑑 id 取得單張 URL');
if (!/this\.load\.image\(key, url\)/.test(info)) errors.push('InfoScene 未透過 Phaser Loader 載入單張插圖');
if (!/this\.textures\.exists\(key\)/.test(info)) errors.push('InfoScene 圖鑑插圖缺少材質快取防重載');
if (!/CODEX_ILLUSTRATION_URLS\[id\]/.test(art)) errors.push('art.ts 缺少單筆圖鑑 URL lookup');

const bootForbidden = [
  'SHIP_WORLD_URLS', 'SHIP_WORLD_DIRECTIONAL_URLS', 'SHIP_BATTLE_URLS', 'SHIP_CARD_URLS',
  'CHARACTER_WALK_URLS', 'SHIP_EQUIPMENT_URLS', 'PORT_BUILDING_URLS',
  'PORT_TOWN_BUILDING_URLS', 'PORT_TOWN_BACKGROUND_URLS', 'HARBOR_SCENE_URLS',
];
for (const name of bootForbidden) {
  if (boot.includes(name)) errors.push(`BootScene 仍引用延遲群組 ${name}`);
}
if (!/portTownBackgroundUrl\(bgId\)/.test(port)) errors.push('PortScene 未載入當前主題背景');
if (!/portTownBuildingUrlsForCulture\(culture\)/.test(port)) errors.push('PortScene 未載入當前文化建築');
if (!/harborSceneUrl\(harborId\)/.test(port)) errors.push('PortScene 未載入當前港景 fallback');
if (!/characterWalkUrl\(heroId\)/.test(port)) errors.push('PortScene 未載入當前主角行走圖');
if (!/shipWorldUrl\(shipId\)/.test(port)) errors.push('PortScene 未載入當前旗艦港町圖');
if (!/shipWorldDirectionalUrl\(typeId\)/.test(worldMap)) errors.push('WorldMapScene 未載入當前旗艦方向圖');
if (!/Object\.entries\(SHIP_CARD_URLS\)/.test(shipyard) || !/Object\.entries\(SHIP_EQUIPMENT_URLS\)/.test(shipyard)) {
  errors.push('ShipyardScene 未載入造船功能群組');
}
if (!/shipBattleUrl\(id\)/.test(battle)) errors.push('BattleScene 未載入本次海戰船圖');
if (!/shipCardUrl\(id\)/.test(info) || !/shipEquipmentUrl\(id\)/.test(info)) errors.push('InfoScene 未載入目前艦隊功能圖');

const chapterFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/story/backgrounds'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith('-chapters'))
  .flatMap((entry) => fs.readdirSync(path.join(root, 'assets/m5/v2/story/backgrounds', entry.name))
    .filter((name) => /_ch\d+_.*\.png$/i.test(name)));
const codexFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/m5-4/codex/illustrations'))
  .filter((name) => /\.png$/i.test(name));
const townBackgroundFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/m5-2/ports/town-backgrounds'))
  .filter((name) => /-town-bg-v1\.png$/i.test(name));
const townBuildingFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/m5-2/ports/town-buildings'))
  .filter((name) => /\.png$/i.test(name));
const harborFiles = fs.readdirSync(path.join(root, 'assets/m5/v2/m5-2/ports/harbors'))
  .filter((name) => /\.png$/i.test(name));

console.log(`章節背景 manifest：${chapterFiles.length} 張｜Boot 預載：0 張｜Story 單次目標：1 張`);
console.log(`圖鑑插圖 manifest：${codexFiles.length} 張｜Boot 預載：0 張｜Info 單次目標：1 張`);
console.log(`港町：${townBackgroundFiles.length} 主題背景／${townBuildingFiles.length} 文化建築／${harborFiles.length} 港景｜Boot 預載：0 張`);
console.log('船隻：世界圖、方向圖、海戰圖、船卡、裝備圖｜Boot 預載：0 張｜使用場景按需載入');
if (chapterFiles.length !== 30) errors.push(`預期 30 張正式章節背景，實際 ${chapterFiles.length} 張`);
if (codexFiles.length !== 120) errors.push(`預期 120 張正式圖鑑插圖，實際 ${codexFiles.length} 張`);
if (townBackgroundFiles.length !== 4) errors.push(`預期 4 張正式港町主題背景，實際 ${townBackgroundFiles.length} 張`);
if (townBuildingFiles.length !== 35) errors.push(`預期 35 張港町文化建築，實際 ${townBuildingFiles.length} 張`);
if (harborFiles.length !== 6) errors.push(`預期 6 張港景 fallback，實際 ${harborFiles.length} 張`);
if (errors.length) {
  console.error(`\n✖ lazy asset 檢查失敗 ${errors.length} 筆：`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('\n✅ M5-8b 延遲載入結構檢查通過');
