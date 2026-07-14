import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [ai, scene, simulator, aiTests, config, worldMap, rulesJson] = await Promise.all([
  read('src/battle/battleAi.ts'),
  read('src/scenes/BattleHexScene.ts'),
  read('tools/simulate-battle-hex.mjs'),
  read('tools/test-battle-ai.mjs'),
  read('src/battle/battleConfig.ts'),
  read('src/scenes/WorldMapScene.ts'),
  read('src/data/battleRules.json'),
]);

const fail = (message) => { throw new Error(`❌ ${message}`); };
const requireText = (source, token, label) => {
  if (!source.includes(token)) fail(`缺少 ${label}：${token}`);
};

for (const [token, label] of [
  ['export function chooseBattleAiDecision', 'AI 單步決策入口'],
  ['expectedDamage >= candidate.target.hull', '擊沉旗艦優先級'],
  ['AI_BOARDING_MIN_CHANCE = 0.65', '接舷 65% 門檻'],
  ["reason: 'best_cannon'", '最高預估傷害砲擊'],
  ['AI_RETREAT_HULL_RATIO = 0.25', '低耐久撤退門檻'],
  ["reason: 'move_to_attack'", '朝攻擊位置移動'],
  ["reason: 'wait'", '無合法動作等待'],
  ['compareUnitPriority', '旗艦／耐久／id 穩定同分排序'],
]) requireText(ai, token, label);

for (const [pattern, label] of [
  [/from\s+['"]phaser['"]|import\s+Phaser/i, 'battleAi 不得依賴 Phaser'],
  [/Math\.random\s*\(/, 'battleAi 不得直接使用 Math.random'],
  [/from\s+['"][^'"]*battleEngine['"]/, 'battleAi 只能產生命令，不得匯入並執行引擎'],
  [/\.hull\s*[-+]?=(?!=)/, 'battleAi 不得直接修改耐久'],
  [/\.hex\s*=(?!=)/, 'battleAi 不得直接修改位置'],
  [/\.winner\s*=(?!=)/, 'battleAi 不得直接修改勝敗'],
]) if (pattern.test(ai)) fail(label);

for (const [token, label] of [
  ["import { chooseBattleAiDecision }", 'Scene 接入純 AI'],
  ['chooseBattleAiDecision(this.battle, this.currentMap(), \'enemy\')', 'Scene 只要求敵方決策'],
  ['this.applyCmd(decision.command)', 'AI 命令經 Scene 共用引擎入口'],
  ['this.enemyStepCount <= 64', '畫面敵方回合防死循環上限'],
  ['this.battle.activeSide === \'enemy\'', '敵方回合狀態鎖'],
  ["query.get('p6demo')", '固定瀏覽器 AI 驗收案例'],
  ['六角格海戰（P8 美術整合）', 'P8 向後相容預覽標示'],
]) requireText(scene, token, label);
if (scene.includes('P5 預覽版敵方直接結束回合')) fail('不得保留 P5 直接跳過敵方回合');

for (const [token, label] of [
  ['chooseBattleAiDecision(state, map, state.activeSide)', '模擬器共用 AI'],
  ['engine.applyCommand(state, map, decision.command, rng)', '模擬器逐命令經 engine 驗證'],
  ['assertBattleStateValid', '模擬狀態完整性檢查'],
  ['simulateBatch(120)', '120 場固定 seed 模擬'],
  ['assert.deepEqual(second, first', '固定 seed 完整重播驗證'],
]) requireText(`${simulator}\n${aiTests}`, token, label);

if (!/USE_HEX_BATTLE\s*=\s*false/.test(config)) fail('P7 前正式六角格入口旗標必須維持 false');
if (!worldMap.includes('battleSceneKey') || !worldMap.includes('createHexBattleLaunch')) fail('P7 WorldMap integration missing');
if (!rulesJson.includes('autoBattle')) fail('P6-2 後必須保留資料化自動戰鬥規則');

const reasonCount = (ai.match(/reason:\s*'/g) ?? []).length;
console.log(`AI 決策理由 ${reasonCount} 個｜Scene 64 步安全上限｜固定模擬 120 場 × 雙次重播`);
console.log('正式流程：USE_HEX_BATTLE=false｜P6 AI 基線與 P6-2 規則並存');
console.log('✅ P6 敵方 AI 優先級、engine 驗證、死循環防線與回退入口檢查通過');
