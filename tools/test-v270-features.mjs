// Usage: node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-v270-features.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapsData from '../src/data/battleMaps.json';
import landmarksData from '../src/data/townLandmarks.json';
import codexData from '../src/data/codex.json';
import portsData from '../src/data/ports.json';
import yuegangScene from '../src/data/town/yuegang.json';
import { offsetToAxial } from '../src/battle/hex.ts';
import { applyCommand, createBattleState } from '../src/battle/battleEngine.ts';
import { createSeededRng } from '../src/battle/battleRules.ts';
import { TownController } from '../src/town/TownController.ts';

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
const adapterMod = await import('../src/battle/battleAdapter.ts');
const tutorialMod = await import('../src/tutorial.ts');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cases = 0;
const test = (name, run) => { run(); cases += 1; console.log('ok ' + name); };

test('5 種特產皆有高價收購港且不與本港販售衝突，棉布與木材皆有低價產地', () => {
  for (const goodId of ['sulfur', 'rattan', 'lacquer', 'tin', 'coral']) {
    const dearPorts = portsData.ports.filter((p) => p.dear.includes(goodId));
    assert.ok(dearPorts.length >= 2, `${goodId} 應至少有 2 座高價收購港`);
    for (const p of dearPorts) {
      assert.ok(!p.sells.includes(goodId), `${p.id} 不應同時販售與高價收購 ${goodId}`);
    }
  }
  assert.ok(portsData.ports.some((p) => p.cheap.includes('cotton')), 'cotton 應有特產港');
  assert.ok(portsData.ports.some((p) => p.cheap.includes('wood')), 'wood 應有特產港');
});

test('買價套用折扣且同港賣出永遠嚴格低於買價防洗錢；商人聲望依累計銷售額累積', () => {
  const s = stateMod.newGame('lin');
  s.equip.accessory = 'ac_merchant_credit';
  s.mates.push({ id: 'he_bin', role: 'purser' });
  s.mates.push({ id: 'li_dan', role: 'interpreter' });
  const hirado = stateMod.PORTS.find((p) => p.id === 'hirado');
  for (const goodId of hirado.sells) {
    const buy = stateMod.priceOf(s, hirado, goodId, s.day);
    const sell = stateMod.sellPriceOf(s, hirado, goodId, s.day);
    assert.ok(sell < buy, `同港 ${goodId} 賣價 (${sell}) 必須低於買價 (${buy})`);
  }

  // 通譯在異文化港（林海生在平戶）提供額外 4% 優惠，在同文化港（月港）為 0
  const yuegang = stateMod.PORTS.find((p) => p.id === 'yuegang');
  assert.equal(stateMod.interpreterTradeBonus(s, hirado), 0.04);
  assert.equal(stateMod.interpreterTradeBonus(s, yuegang), 0);

  // 小額銷售 600 + 500 = 1100 應累積 +1 商人聲望
  const repBefore = s.reputation.trade;
  stateMod.recordSale(s, hirado, 'silk_raw', 3, s.day, 600);
  assert.equal(s.reputation.trade, repBefore);
  stateMod.recordSale(s, hirado, 'silk_raw', 3, s.day, 500);
  assert.equal(s.reputation.trade, repBefore + 1);
});

test('水手長節省 15% 糧水消耗、通譯新增酒館情報、書記知識經驗 +15%', () => {
  const s = stateMod.newGame('lin');
  s.crew = 50; // base 10/day
  assert.equal(stateMod.foodPerDay(s.crew, s), 10);
  s.mates.push({ id: 'yan_siqi', role: 'boatswain' });
  assert.equal(stateMod.foodPerDay(s.crew, s), 9);
  assert.equal(stateMod.waterPerDay(s.crew, s), 9);

  const withoutInterp = stateMod.rumorTexts(s);
  s.mates.push({ id: 'li_dan', role: 'interpreter' });
  const withInterp = stateMod.rumorTexts(s);
  assert.ok(withInterp.some((line) => line.includes('通譯打聽到的跨區情報')));
  assert.ok(withInterp.length >= withoutInterp.length);

  const s2 = stateMod.newGame('lin');
  s2.mates.push({ id: 'xu_fuyuan', role: 'scholar' });
  const res = stateMod.addXp(s2, 100, { knowledge: true });
  assert.equal(res.gained, 115);
});

test('個人防具線性生效、四件探險飾品優於商店貨', () => {
  const s = stateMod.newGame('lin');
  const fNone = stateMod.crewLossFactor(s);
  s.equip.armor = 'a_cloth';
  const fCloth = stateMod.crewLossFactor(s);
  s.equip.armor = 'a_leather';
  const fLeather = stateMod.crewLossFactor(s);
  s.equip.armor = 'a_brigandine';
  const fBrig = stateMod.crewLossFactor(s);
  s.equip.armor = 'a_nanban';
  const fNanban = stateMod.crewLossFactor(s);
  assert.ok(fNone > fCloth && fCloth > fLeather && fLeather > fBrig && fBrig > fNanban, '四件防具減傷應嚴格遞進');

  // 探險飾品優於普通商店貨
  const sShop = stateMod.newGame('lin');
  const sRare = stateMod.newGame('lin');
  sShop.equip.accessory = 'ac_compass';
  sRare.equip.accessory = 'tr_old_compass';
  assert.ok(stateMod.gearSpeedMod(sRare) > stateMod.gearSpeedMod(sShop));

  sShop.equip.accessory = 'ac_charm';
  sRare.equip.accessory = 'tr_mazu_amulet';
  assert.ok(stateMod.fatigueMod(sRare) < stateMod.fatigueMod(sShop));

  sShop.equip.accessory = 'ac_telescope';
  sRare.equip.accessory = 'tr_seafarer_telescope';
  assert.ok(stateMod.ambushMod(sRare) < stateMod.ambushMod(sShop));
});

test('軍師計策（鼓舞軍心／順風火攻）規則正確且限用 1 次', () => {
  const s = stateMod.newGame('lin');
  s.mates.push({ id: 'chen_yonghua', role: 'strategist' });
  const launch = adapterMod.createHexBattleLaunch(s, { kind: 'pirate', tier: 1 });
  assert.equal(launch.hasStrategist, true);

  const openSea = mapsData.maps.find((m) => m.id === 'open_sea');
  const rng = createSeededRng(42);
  const p0 = { ...launch.units[0], hex: offsetToAxial(3, 3), hull: 60, hullMax: 100, cannonPower: 1 };
  const eFar = { ...launch.units.find((u) => u.side === 'enemy'), hex: offsetToAxial(9, 3), hull: 80, hullMax: 80 };
  const stFar = createBattleState({ seed: 42, mapId: 'open_sea', units: [p0, eFar], strategistAvailable: true });
  const fireTooFar = applyCommand(stFar, openSea, { type: 'tactic', tactic: 'fire' }, rng);
  assert.equal(fireTooFar.ok, false);
  assert.equal(fireTooFar.error, 'TACTIC_NO_TARGETS');

  // 3 格內可成功火攻且第二次不能再用
  const eNear = { ...eFar, hex: offsetToAxial(5, 3) };
  const stNear = createBattleState({ seed: 42, mapId: 'open_sea', units: [p0, eNear], strategistAvailable: true });
  const fireOk = applyCommand(stNear, openSea, { type: 'tactic', tactic: 'fire' }, rng);
  assert.equal(fireOk.ok, true);
  assert.ok(fireOk.state.units.find((u) => u.id === eNear.id).hull < 80);
  const second = applyCommand(fireOk.state, openSea, { type: 'tactic', tactic: 'inspire' }, rng);
  assert.equal(second.ok, false);
  assert.equal(second.error, 'TACTIC_ALREADY_USED');

  // 鼓舞軍心回復耐久並 +15% 砲擊威力
  const inspireOk = applyCommand(stFar, openSea, { type: 'tactic', tactic: 'inspire' }, rng);
  assert.equal(inspireOk.ok, true);
  const inspiredP0 = inspireOk.state.units.find((u) => u.id === p0.id);
  assert.ok(inspiredP0.hull > 60);
  assert.ok(inspiredP0.cannonPower > 1.14);
});

test('跨存檔全域圖鑑可達成 100% 福爾摩沙活字典，暫態狀態不寫入', () => {
  store.clear();
  const allIds = stateMod.CODEX_ENTRIES.map((e) => e.id);
  const half = Math.floor(allIds.length / 2);

  const lin = stateMod.newGame('lin');
  stateMod.unlockCodex(lin, allIds.slice(0, half));
  stateMod.saveGame(lin, 0);

  const peter = stateMod.newGame('peter');
  stateMod.unlockCodex(peter, allIds.slice(half));
  stateMod.saveGame(peter, 1);

  assert.equal(stateMod.codexCollection(peter).rate < 100, true);
  assert.equal(stateMod.globalCodexCollection(peter).unlocked, allIds.length);
  assert.equal(stateMod.globalCodexCollection(peter).rate, 100);
  assert.equal(stateMod.codexTitle(peter), '福爾摩沙活字典');

  // 暫態狀態不得寫入全域圖鑑
  store.clear();
  const preview = stateMod.markTransientGameState(stateMod.newGame('chiyo'));
  stateMod.unlockCodex(preview, [allIds[0]]);
  assert.equal(stateMod.loadGlobalCodex().length, 0);
});

test('台灣東部黑潮加速帶：順流加速、逆流減速、流域外無影響', () => {
  const dirNorthEast = -Math.PI / 3;
  const dirSouthWest = (2 * Math.PI) / 3;
  const boost = stateMod.kuroshioSpeedMod(4180, 2320, dirNorthEast);
  const drag = stateMod.kuroshioSpeedMod(4180, 2320, dirSouthWest);
  const outside = stateMod.kuroshioSpeedMod(1800, 5000, dirNorthEast);
  assert.ok(boost > 1.15, `黑潮順流應明顯加速，實際 ${boost}`);
  assert.ok(drag < 0.95, `逆黑潮應減速，實際 ${drag}`);
  assert.equal(outside, 1);
  assert.ok(stateMod.kuroshioLabel(4180, 2320, dirNorthEast).includes('黑潮順流'));
});

test('HD-2D 歷史地標資料完整、所有圖鑑 ID 有效，且 TownController 卡牆會安全中止尋路', () => {
  const entries = new Map(stateMod.CODEX_ENTRIES.map((e) => [e.id, e]));
  const portSet = new Set(portsData.ports.map((p) => p.id));
  assert.ok(landmarksData.landmarks.length >= 14);
  for (const lm of landmarksData.landmarks) {
    assert.ok(portSet.has(lm.portId), `無效地標港口 ${lm.portId}`);
    assert.ok(Number.isInteger(lm.firstYear), `地標 ${lm.id} 缺少開放年代`);
    assert.equal(entries.get(lm.id)?.source, `town:${lm.portId}`);
    assert.ok(!codexData.entries.some((e) => e.id === lm.id), `地標 ${lm.id} 不可與既有圖鑑重複`);
  }

  // 驗證 TownController 卡牆偵測：若 renderer 正常運作但目標被強制阻擋，360ms 後自動清空路線
  const fakeRenderer = {
    player: { ...yuegangScene.spawn },
    mount() {}, update() {}, pause() {}, resume() {}, dispose() {},
    getPlayerPosition() { return { ...this.player }; },
    setPlayerPosition(p) { this.player = { ...p }; },
    setNavigationPath() {},
    screenToGround() { return null; },
    pickFacility() { return null; },
    worldToScreen() { return { x: 0, y: 0 }; },
    snapshot() { return {}; },
  };
  const ctrl = new TownController(yuegangScene, fakeRenderer);
  assert.equal(ctrl.navigateTo({ u: 0, v: 2.0 }), true);
  // 模擬碰撞回傳不動（測試卡牆脫困分支）
  ctrl.navigator.moveWithCollision = (start) => ({ ...start });
  for (let i = 0; i < 15; i += 1) ctrl.update(i * 40, 40, { x: 0, y: 0 });
  assert.equal(ctrl.snapshot().route.length, 0, '卡牆超過 360ms 應自動清空路線停止踏步');

  // 驗證重玩核心教學
  const tState = stateMod.newGame('lin');
  tutorialMod.skipTutorialModule(tState, 'core');
  assert.equal(tState.tutorial.onboarding, 'skipped');
  tutorialMod.restartCoreTutorial(tState);
  assert.equal(tState.tutorial.onboarding, 'active');
  assert.equal(tutorialMod.currentTutorialStep(tState)?.id, 'core_enter_port');
});

test('交易所任務需求與已知高價收購港輔助函式正確', () => {
  const s = stateMod.newGame('lin');
  s.quest = { type: 'delivery', goodId: 'sulfur', qty: 6, portId: 'yuegang', deadlineDay: 500, reward: 900, originPortId: 'tayouan' };
  const need = stateMod.neededGoodsForQuests(s);
  assert.equal(need.sulfur, 6);

  s.visitedPorts.push('yuegang', 'guangzhou');
  const dear = stateMod.knownDearPortsForGood(s, 'sulfur');
  assert.ok(dear.includes('月港') && dear.includes('廣州'));

  // 確認 ThreeTownRenderer 已實作四方向走路與地標／路人
  const threeCode = fs.readFileSync(path.join(root, 'src/town/ThreeTownRenderer.ts'), 'utf8');
  assert.ok(threeCode.includes('groundMovementToScreen') && threeCode.includes('buildTownExtras'));
});

console.log(`V2.7.0 features ${cases} cases passed`);
