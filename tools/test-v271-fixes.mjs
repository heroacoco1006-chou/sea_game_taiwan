// Run with the project's node-ts-json-loader.
import assert from 'node:assert/strict';
import * as s from '../src/state.ts';
import * as tutorial from '../src/tutorial.ts';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

let failed = 0;
let passed = 0;
function test(name, run) {
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  storage.clear();
  try { run(); passed++; console.log('ok', name); }
  catch (err) { failed++; console.error('FAIL', name, err.message); }
}

test('codex: imports old raw saves and aggregates without opening each slot', () => {
  const lin = s.newGame('lin');
  const peter = s.newGame('peter');
  lin.story.codex = ['codex_lin_2_0'];
  peter.story.codex = ['codex_peter_1_0'];
  s.saveGame(lin, 0);
  s.saveGame(peter, 1);
  storage.delete('seagame_global_codex_v1'); // pre-upgrade browser
  const loaded = s.loadGame(1);
  assert.ok(s.globalCodexIdsForState(loaded).has('codex_lin_2_0'));
  assert.equal(s.getActiveSlot(), 1);
  assert.deepEqual(loaded.story.codex, peter.story.codex);
});

test('codex: a backup preserves entries unique to the global collection', () => {
  const lin = s.newGame('lin');
  s.unlockCodex(lin, ['codex_lin_2_0']);
  s.saveGame(lin, 0);
  const peter = s.newGame('peter');
  s.saveGame(peter, 1);
  s.deleteSave(0);
  const backup = s.exportSaveSlotJson(1);
  storage.clear();
  assert.ok(s.importSaveSlotJson(1, backup).ok);
  const restored = s.loadGame(1);
  assert.ok(s.globalCodexIdsForState(restored).has('codex_lin_2_0'));
  assert.ok(!restored.story.codex.includes('codex_lin_2_0'));
  const oldRaw = JSON.stringify(lin);
  assert.ok(s.importSaveSlotJson(0, oldRaw).ok);
  const snapshot = [...storage];
  assert.ok(!s.importSaveSlotJson(0, '{bad').ok);
  assert.deepEqual([...storage], snapshot);
});

test('landmarks: date gates and independent codex rewards on all three routes', () => {
  for (const hero of ['lin', 'peter', 'chiyo']) {
    const state = s.newGame(hero);
    state.day = (1625 - 1622) * 360 + 1;
    assert.equal(s.availableTownLandmark(state, 'tamsui'), undefined);
    assert.equal(s.availableTownLandmark(state, 'keelung'), undefined);
    assert.deepEqual(s.visitTownLandmark(state, 'keelung'), []);
    state.day = (1628 - 1622) * 360 + 1;
    for (const port of ['keelung', 'tamsui']) {
      const lm = s.availableTownLandmark(state, port);
      assert.ok(lm);
      assert.equal(s.visitTownLandmark(state, port).length, 1);
      assert.ok(state.story.codex.includes(lm.id));
      assert.deepEqual(s.visitTownLandmark(state, port), []);
    }
    assert.ok(!state.story.codex.includes('codex_peter_6_0'));
    state.day = (1642 - 1622) * 360 + 1;
    s.visitTownLandmark(state, 'tamsui');
    assert.ok(!state.story.codex.includes('codex_peter_6_0'));
  }
});

test('dice: paid limit persists, day resets it, free games award nothing', () => {
  let state = s.newGame();
  state.gold = 1000;
  state.fatigue = 50;
  for (let i = 0; i < 3; i++) assert.ok(s.resolveTavernDice(state, true, () => 0)); // ties count
  s.saveGame(state, 2);
  state = s.loadGame(2);
  assert.equal(s.tavernDicePaidRemaining(state), 0);
  assert.equal(s.resolveTavernDice(state, true, () => assert.fail('blocked before rolling')), null);
  let count = 0;
  for (let i = 0; i < 25; i++) assert.ok(s.resolveTavernDice(state, false, () => count++ % 4 < 2 ? 0.99 : 0));
  assert.equal(state.gold, 1000);
  assert.equal(state.fatigue, 50);
  state.day++;
  assert.equal(s.tavernDicePaidRemaining(state), 3);
  assert.ok(s.resolveTavernDice(state, true, () => count++ % 4 < 2 ? 0.99 : 0));
  assert.equal(state.gold, 1050);
  assert.equal(state.fatigue, 45);
});

test('trade: cross-region rumor filters misleading items and drops guarantees', () => {
  const state = s.newGame('lin');
  state.mates.push({ id: 'li_dan', role: 'interpreter' });
  const tamsui = s.PORTS.find(p => p.id === 'tamsui');
  state.visitedPorts.push('tamsui');
  assert.ok(!s.knownDearPortsForGood(state, 'rice').includes(tamsui.name));
  for (const port of s.PORTS) {
    const rumor = s.rumorTexts(state, port).find(line => line.includes('通譯打聽'));
    assert.ok(rumor);
    const match = rumor.match(/【(.+?)（(.+?)）】.*【(.+?)】/);
    assert.ok(match);
    const [_, name, region, goodName] = match;
    const target = s.PORTS.find(p => p.name === name);
    const good = s.GOODS.find(g => g.name === goodName);
    assert.notEqual(region, port.region);
    assert.ok(!target.sells.includes(good.id));
    assert.ok(s.sellPriceOf(state, target, good.id, state.day) > good.basePrice);
    assert.ok(!rumor.includes('一定'));
  }
});

test('supplies: 15 percent savings accrue across days for small and large crews', () => {
  const small = s.newGame('lin');
  small.crew = 15;
  small.food = small.water = 120;
  assert.equal(s.sailableDays(small), 40);
  small.mates.push({ id: 'yan_siqi', role: 'boatswain' });
  assert.equal(s.sailableDays(small), 47);
  small.crew = 5;
  small.food = small.water = 1;
  small.sailingSupplyCarry = 20;
  assert.equal(s.sailableDays(small), 1, '補給已耗盡的下個航行日不可列入估計');
  for (const crew of [5, 10, 15, 20, 50]) {
    let state = s.newGame();
    state.crew = crew;
    state.food = state.water = 250;
    state.mates.push({ id: 'yan_siqi', role: 'boatswain' });
    for (let day = 1; day <= 20; day++) {
      s.consumeDailySailingSupplies(state);
      if (day === 1) { s.saveGame(state); state = s.loadGame(); }
    }
    assert.equal(state.food, 250 - 17 * Math.max(1, Math.ceil(crew / 5)));
    assert.equal(state.water, state.food);
  }
});

test('tutorial: far-off replay guides to nearest port; town replay starts at movement', () => {
  const state = s.newGame();
  state.ship.x = 2000;
  state.ship.y = 3000;
  const before = { ...state.ship };
  tutorial.restartCoreTutorial(state, 'WorldMap');
  const far = tutorial.currentTutorialStep(state, 'WorldMap');
  assert.match(far.body.desktop, /航向【.+】/);
  assert.match(far.body.touch, /靠近/);
  assert.deepEqual(state.ship, before);
  const port = s.PORTS[0];
  Object.assign(state.ship, { x: port.x, y: port.y });
  assert.ok(tutorial.currentTutorialStep(state, 'WorldMap').body.desktop.includes(port.name));
  assert.equal(tutorial.handleTutorialEvent(state, 'port_entered', { portId: port.id }).changed, true);
  assert.equal(tutorial.currentTutorialStep(state, 'Port').id, 'core_town_move');
  tutorial.restartCoreTutorial(state, 'Port');
  assert.equal(tutorial.currentTutorialStep(state, 'Port').id, 'core_town_move');
  assert.match(tutorial.tutorialResumeStep(state, 'WorldMap').body.touch, /進港/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
