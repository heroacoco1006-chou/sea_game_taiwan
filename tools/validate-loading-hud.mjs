import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const requirePattern = (text, pattern, message) => {
  if (!pattern.test(text)) throw new Error(message);
};

const moduleText = read('src/loadingHud.ts');
requirePattern(moduleText, /Phaser\.Loader\.Events\.PROGRESS/, '共用載入元件沒有監聽 progress');
requirePattern(moduleText, /Phaser\.Loader\.Events\.FILE_PROGRESS/, '共用載入元件沒有監聽 fileprogress');
requirePattern(moduleText, /Phaser\.Loader\.Events\.FILE_LOAD_ERROR/, '共用載入元件沒有監聽 loaderror');
requirePattern(moduleText, /scene\.scene\.restart\(state\.restartData\)/, '重試沒有保留原場景參數');
requirePattern(moduleText, /scene\.scene\.start\('Title'\)/, '載入失敗畫面缺少回標題');
requirePattern(moduleText, /部分內容載入失敗/, '載入失敗提示缺少白話標題');
requirePattern(moduleText, /BASE_W[\s\S]*BASE_H|BASE_H[\s\S]*BASE_W/, '載入元件沒有使用 BASE 尺寸排版');
requirePattern(moduleText, /loadtest/, '缺少可重複的 404 瀏覽器驗收入口');

const sceneFiles = [
  'BootScene.ts',
  'WorldMapScene.ts',
  'PortScene.ts',
  'StoryScene.ts',
  'InfoScene.ts',
  'ShipyardScene.ts',
  'BattleScene.ts',
  'BattleHexScene.ts',
];
for (const name of sceneFiles) {
  const text = read(`src/scenes/${name}`);
  requirePattern(text, /installLoadingHud\(this\)/, `${name} 沒有接上共用載入進度`);
  requirePattern(text, /showLoadingFailureIfNeeded\(this\)/, `${name} 沒有在 create 阻止半載入場景`);
}

const battleHex = read('src/scenes/BattleHexScene.ts');
if (battleHex.includes('正在展開海戰圖')) throw new Error('BattleHexScene 仍保留舊的獨立載入 UI');

console.log(`載入 HUD 驗證通過：共用元件＋${sceneFiles.length} 個延遲載入場景皆已接線`);
