import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [rules, scene, simulator, tests, config, worldMap, rulesJson, encountersJson, spec] = await Promise.all([
  read('src/battle/battleRules.ts'),
  read('src/scenes/BattleHexScene.ts'),
  read('tools/simulate-battle-hex.mjs'),
  read('tools/test-battle-auto.mjs'),
  read('src/battle/battleConfig.ts'),
  read('src/scenes/WorldMapScene.ts'),
  read('src/data/battleRules.json'),
  read('src/data/battleEncounters.json'),
  read('2026-07-11_六角格回合制海戰架構與低階模型施工規格.md'),
]);

const fail = (message) => { throw new Error('❌ ' + message); };
const requireText = (source, token, label) => {
  if (!source.includes(token)) fail('缺少 ' + label + '：' + token);
};

const ruleData = JSON.parse(rulesJson);
if (ruleData.autoBattle?.minAdvantageRatio !== 1.5) fail('自動戰鬥門檻必須資料化為 1.5');

for (const [token, label] of [
  ['export function sidePower', '共用艦隊戰力函式'],
  ["unit.status === 'active'", '只計仍在場船隻'],
  ['unit.hull', '耐久戰力'],
  ['unit.cannons * cannon.power * BATTLE_RULES.damage.basePerCannon', '砲種與基準傷害戰力'],
  ['unit.crew * 0.5', '水手戰力'],
  ['unit.flagship ? 1.2 : 1', '旗艦 1.2 權重'],
  ['export function assessAutoBattle', '自動戰鬥門檻判定'],
  ['advantageRatio >= requiredRatio', '門檻比較'],
]) requireText(rules, token, label);

for (const [token, label] of [
  ["import { chooseBattleAiDecision }", '共用雙方 AI'],
  ['assessAutoBattle(this.battle.units)', 'Scene 使用規則層門檻'],
  ["makeButton(this, 1128, 602, 220, 42, '自動戰鬥'", '自動戰鬥按鈕'],
  ["makeButton(this, 1128, 602, 220, 42, '接手指揮'", '接手指揮按鈕'],
  ['this.autoBattle = true', '啟動自動戰鬥'],
  ['this.autoBattle = false', '停止自動戰鬥'],
  ["chooseBattleAiDecision(this.battle, this.currentMap(), this.battle.activeSide)", 'AI 同時代打我方與敵方'],
  ["? 1200 : 180", '新回合 1.2 秒接手窗口'],
  ['this.time.delayedCall(nextDelay, () => this.runAutoBattleStep())', '加速逐步播放'],
  ["p6demo === 'auto'", '瀏覽器固定可用案例'],
  ['六角格海戰（P8 美術整合）', 'P8 預覽標示'],
]) requireText(scene, token, label);
if (scene.includes('sidePower(')) fail('Scene 不得自行重算艦隊戰力');

for (const [token, label] of [
  ["counts = { player: 5, enemy: 5 }", '模擬器可變艦隊數'],
  ['cells.slice(0, counts[side])', '依指定數量建船'],
  ['const fleetSizes = [[1, 1], [2, 3], [5, 5]]', '三種艦隊規模'],
  ['simulateBatch(36)', 'P6-2 固定重播案例'],
  ['assert.deepEqual(second, first)', '固定 seed 完整重播'],
  ['接手時需保留可手動操作的我方船', '接手後手動流程測試'],
]) requireText(simulator + '\n' + tests, token, label);

for (const token of [
  'tier 1：1～2 艘；初版機率固定為 1 艘 80%、2 艘 20%',
  'tier 2：2～3 艘；初版機率固定為 2 艘 60%、3 艘 40%',
  'tier 3：3～4 艘；初版機率固定為 3 艘 40%、4 艘 60%',
  'P7 開工阻斷閘門',
  '臨時故事友軍',
]) requireText(spec, token, 'P7 核准規則');

if (!/USE_HEX_BATTLE\s*=\s*true/.test(config)) fail('P9 後正式六角格入口旗標必須維持 true');
if (!worldMap.includes('battleSceneKey') || !worldMap.includes('createHexBattleLaunch')) fail('P7 WorldMap integration missing');
if (JSON.parse(encountersJson).encounters.length === 0) fail('P7 encounter data missing');

console.log('門檻 1.5｜雙方共用 AI｜自動加速｜我方回合可接手｜1v1／2v3／5v5');
console.log('P7 閘門：玩家實際艦隊、tier 機率、具名大戰、故事友軍均已寫入規格');
console.log('✅ P6-2 自動戰鬥規則、Scene 控制、固定重播與 P7 防提前整合檢查通過');
