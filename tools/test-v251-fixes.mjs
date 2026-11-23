// Usage: node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-v251-fixes.mjs
import assert from 'node:assert/strict';
import yuegangData from '../src/data/town/yuegang.json';
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
const adapter = await import('../src/battle/battleAdapter.ts');
const engine = await import('../src/battle/battleEngine.ts');

let cases = 0;
const test = (name, run) => { run(); cases += 1; console.log('ok ' + name); };

test('六角格海戰正確套用砲術長 ×1.2 與副隊長 +8 加成', () => {
  const base = stateMod.newGame('lin');
  base.mates = [];
  const baseLaunch = adapter.createHexBattleLaunch(base, { kind: 'pirate', tier: 1 }, 42);
  const baseFlag = baseLaunch.units.find((u) => u.id === 'p0');

  const withRoles = stateMod.newGame('lin');
  withRoles.mates = [
    { id: 'shen_yourong', role: 'gunner' },
    { id: 'yan_siqi', role: 'vice' },
  ];
  const roleLaunch = adapter.createHexBattleLaunch(withRoles, { kind: 'pirate', tier: 1 }, 42);
  const roleFlag = roleLaunch.units.find((u) => u.id === 'p0');

  const expectedGunnerMod = 1.2 * (1 + stateMod.fleetStat(withRoles, 'gun') / 300);
  const expectedBoard = stateMod.weaponBoard(withRoles)
    + 8
    + Math.round(stateMod.fleetStat(withRoles, 'lead') / 15 + stateMod.fleetStat(withRoles, 'val') / 12);

  assert.ok(Math.abs(roleFlag.gunnerMod - expectedGunnerMod) < 1e-9);
  assert.equal(roleFlag.boardingBonus, expectedBoard);
  assert.ok(roleFlag.gunnerMod > baseFlag.gunnerMod * 1.19);
  assert.ok(roleFlag.boardingBonus >= baseFlag.boardingBonus + 8);
});

test('六角格海戰戰敗回港不會沒收原本滿載的糧水', () => {
  const s = stateMod.newGame('peter');
  s.food = 50;
  s.water = 55;
  const launch = adapter.createHexBattleLaunch(s, { kind: 'pirate', tier: 1 }, 7);
  const battle = engine.createBattleState({ seed: launch.seed, mapId: launch.mapId, units: launch.units });
  battle.winner = 'enemy';
  adapter.settleHexBattle(s, launch, battle);
  assert.equal(s.food, 50);
  assert.equal(s.water, 55);
});

test('三位主角開局皆享有前 10 天實際遊玩天數保護期', () => {
  for (const heroId of ['lin', 'peter', 'chiyo']) {
    const s = stateMod.newGame(heroId);
    assert.equal(stateMod.elapsedPlayDays(s), 0, `${heroId} 開局經過天數應為 0`);
    s.day += 10;
    assert.equal(stateMod.elapsedPlayDays(s), 10);
    s.day += 1;
    assert.equal(stateMod.elapsedPlayDays(s), 11);
  }
});

test('存檔備份匯出與匯入驗證正常且能拒絕無效內容', () => {
  const s = stateMod.newGame('chiyo');
  s.gold = 98765;
  assert.equal(stateMod.saveGame(s, 2), true);
  const json = stateMod.exportSaveSlotJson(2);
  assert.ok(json && json.includes('98765'));

  const bad = stateMod.importSaveSlotJson(4, '{"not":"a save"}');
  assert.equal(bad.ok, false);

  const ok = stateMod.importSaveSlotJson(4, json);
  assert.equal(ok.ok, true);
  const loaded = stateMod.loadGame(4);
  assert.equal(loaded.gold, 98765);
  assert.equal(loaded.story.heroId, 'chiyo');
});

test('HD-2D TownController 點擊建築走到門口後會回報自動進入', () => {
  const fakeRenderer = {
    player: { u: 0, v: 0 },
    mount() {},
    update() {},
    pause() {},
    resume() {},
    dispose() {},
    getPlayerPosition() { return { ...this.player }; },
    setPlayerPosition(p) { this.player = { ...p }; },
    setNavigationPath() {},
    screenToGround() { return null; },
    pickFacility() { return null; },
    worldToScreen() { return { x: 0, y: 0 }; },
    snapshot() { return { mounted: true, paused: false, frames: 0, renderCalls: 0, geometries: 0, textures: 0, canvasWidth: 2560, canvasHeight: 1440, playerX: this.player.u, playerZ: this.player.v }; },
  };
  const controller = new TownController(yuegangData, fakeRenderer, yuegangData.spawn);
  assert.equal(controller.navigateToFacility('trade'), true);
  let arrived = null;
  for (let step = 0; step < 300 && !arrived; step += 1) {
    controller.update(step * 50, 50, { x: 0, y: 0 });
    arrived = controller.consumeArrivedFacility();
  }
  assert.equal(arrived, 'trade');
  assert.equal(controller.consumeArrivedFacility(), null);
});

console.log(`V2.5.1 fixes ${cases} cases passed`);
