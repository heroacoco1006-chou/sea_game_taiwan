import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [scene, rules, engine, config, worldMap] = await Promise.all([
  read('src/scenes/BattleHexScene.ts'),
  read('src/battle/battleRules.ts'),
  read('src/battle/battleEngine.ts'),
  read('src/battle/battleConfig.ts'),
  read('src/scenes/WorldMapScene.ts'),
]);

const fail = (message) => {
  throw new Error(`❌ ${message}`);
};
const requireText = (source, token, label) => {
  if (!source.includes(token)) fail(`缺少 ${label}：${token}`);
};

for (const [token, label] of [
  ['cannonDamageBounds(', '砲擊預估範圍來源'],
  ['validateCannonAttack(', '砲擊合法性來源'],
  ['validateBoardingAttack(', '接舷合法性來源'],
  ["type: 'cannon'", '砲擊引擎指令'],
  ["type: 'board'", '接舷引擎指令'],
  ["type: 'repair'", '修整引擎指令'],
  ["type: 'wait'", '等待引擎指令'],
  ['playEvents(result.events)', '引擎事件播放'],
  ['確認砲擊', '兩階段砲擊確認'],
  ['確認接舷', '兩階段接舷確認'],
  ['預估傷害：', '畫面預估文字'],
  ['!hasBattleEnded', '第 12 回合不顯示第 13 回合'],
  ["get('p5demo')", '固定瀏覽器驗收案例'],
]) requireText(scene, token, label);

for (const [pattern, label] of [
  [/Math\.random\s*\(/, 'Scene 直接使用 Math.random'],
  [/rollCannonDamage\s*\(/, 'Scene 重算砲擊傷害'],
  [/resolveBoarding\s*\(/, 'Scene 重算接舷結果'],
  [/\.hull\s*[-+]=/, 'Scene 直接修改耐久'],
  [/\.crew\s*[-+]=/, 'Scene 直接修改水手'],
  [/\.winner\s*=(?!=)/, 'Scene 直接設定勝敗'],
]) if (pattern.test(scene)) fail(label);

requireText(rules, 'export function validateBoardingAttack', '純規則接舷合法性函式');
requireText(engine, 'validateBoardingAttack(actor, target!)', '引擎共用接舷合法性函式');
requireText(config, 'USE_HEX_BATTLE = true', 'P9 後正式六角格入口旗標');
if (!worldMap.includes('battleSceneKey') || !worldMap.includes('createHexBattleLaunch')) fail('P7 WorldMap integration missing');

const eventBranches = (scene.match(/event\.type ===/g) ?? []).length;
const actionButtons = (scene.match(/this\.btn(?:Cannon|Board|Repair|Wait)/g) ?? []).length;
if (eventBranches < 6) fail(`事件呈現分支不足：${eventBranches}`);
if (actionButtons < 8) fail(`四種主要行動按鈕建立／切換不足：${actionButtons}`);

console.log(`P5 事件分支 ${eventBranches} 個｜主要行動按鈕引用 ${actionButtons} 次`);
console.log('✅ P5 砲擊、接舷、修整、等待、事件顯示與回退入口檢查通過');