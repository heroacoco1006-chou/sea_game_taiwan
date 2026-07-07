import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const main = read('src/main.ts');
const controls = read('src/touchControls.ts');
const world = read('src/scenes/WorldMapScene.ts');
const port = read('src/scenes/PortScene.ts');
const ui = read('src/ui.ts');
const errors = [];

const requirePattern = (source, pattern, message) => {
  if (!pattern.test(source)) errors.push(message);
};

requirePattern(html, /viewport-fit=cover/, 'viewport 缺少 viewport-fit=cover');
requirePattern(html, /touch-action:\s*none/, '頁面／canvas 缺少 touch-action: none');
requirePattern(html, /overscroll-behavior:\s*none/, '頁面缺少 overscroll 防護');
requirePattern(main, /activePointers:\s*[2-9]/, 'Phaser 未啟用多點觸控 pointer');

requirePattern(controls, /URLSearchParams\(window\.location\.search\).*touch/, '觸控控制層缺少測試強制開關');
requirePattern(controls, /navigator\.maxTouchPoints/, '觸控控制層未偵測 touch points');
requirePattern(controls, /pointer:\s*coarse/, '觸控控制層未偵測 coarse pointer');
requirePattern(controls, /direction\(\): Direction/, '觸控控制層缺少持續方向狀態');
requirePattern(controls, /consumeAction\(\): boolean/, '觸控控制層缺少情境動作佇列');
requirePattern(controls, /event\.stopPropagation\(\)/, '觸控控制按鈕未阻止事件穿透');

requirePattern(world, /new TouchControls\(this, '互動'\)/, 'WorldMapScene 未建立觸控控制層');
requirePattern(world, /touchControls\?\.direction\(\)/, 'WorldMapScene 未讀取觸控航向');
requirePattern(world, /touchControls\?\.consumeAction\(\)/, 'WorldMapScene 未讀取觸控動作');
requirePattern(world, /performContextAction\(\)/, 'WorldMapScene 鍵盤／觸控未共用 action handler');
requirePattern(world, /this\.scene\.start\('Port'/, 'WorldMapScene action handler 缺少進港');

requirePattern(port, /new TouchControls\(this, '進入'\)/, 'PortScene 未建立觸控控制層');
requirePattern(port, /touchControls\?\.direction\(\)/, 'PortScene 未讀取觸控方向');
requirePattern(port, /touchControls\?\.consumeAction\(\)/, 'PortScene 未讀取觸控進入動作');
requirePattern(port, /currentlyOver\.length > 0/, 'PortScene 未隔離 UI 點擊與地面移動');

const stopPropagationCount = (ui.match(/event\.stopPropagation\(\)/g) ?? []).length;
if (stopPropagationCount < 2) errors.push('共用按鈕或 modal backdrop 缺少事件穿透防護');

console.log('觸控控制：WorldMap 航行／情境動作｜Port 點擊／方向／進入｜Web 手勢防護');
if (errors.length) {
  console.error(`\n✖ 行動觸控結構檢查失敗 ${errors.length} 筆：`);
  for (const error of errors) console.error('  ' + error);
  process.exit(1);
}
console.log('\n✅ 行動觸控結構檢查通過');
