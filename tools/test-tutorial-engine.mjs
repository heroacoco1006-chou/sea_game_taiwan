import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
  key(index) { return [...storage.keys()][index] ?? null; },
  get length() { return storage.size; },
};

const { newGame, loadGame } = await import('../src/state.ts');
const {
  currentTutorialStep,
  enableContextTutorials,
  handleTutorialEvent,
  skipTutorialModule,
  tutorialModuleStatus,
  tutorialModule,
  tutorialResumeStep,
} = await import('../src/tutorial.ts');

for (const heroId of ['lin', 'peter', 'chiyo']) {
  const heroState = newGame(heroId);
  assert.equal(heroState.tutorial.onboarding, 'ask', `${heroId} 新局應詢問是否開始教學`);
  assert.equal(currentTutorialStep(heroState)?.id, 'core_welcome');
}

const resumeState = newGame('lin');
handleTutorialEvent(resumeState, 'tutorial_start');
for (const event of ['port_entered', 'town_moved', 'trade_opened']) handleTutorialEvent(resumeState, event);
assert.equal(currentTutorialStep(resumeState)?.id, 'core_buy');
assert.equal(tutorialResumeStep(resumeState, 'WorldMap')?.title, '回到港口繼續教學');
assert.equal(tutorialResumeStep(resumeState, 'Port')?.title, '回到交易所繼續教學');
assert.equal(tutorialResumeStep(resumeState, 'Trade'), null);
handleTutorialEvent(resumeState, 'trade_bought');
assert.equal(tutorialResumeStep(resumeState, 'WorldMap')?.resumeForStepId, 'core_find_harbor');
const state = newGame('lin');
assert.equal(state.version, 23);
assert.equal(state.tutorial.onboarding, 'ask');
assert.equal(currentTutorialStep(state)?.id, 'core_welcome');

handleTutorialEvent(state, 'tutorial_start');
assert.equal(state.tutorial.onboarding, 'active');
assert.equal(currentTutorialStep(state)?.id, 'core_enter_port');

for (const event of [
  'port_entered',
  'town_moved',
  'trade_opened',
  'trade_bought',
  'harbor_opened',
  'tutorial_continue',
  'world_departed',
  'world_moved',
  'tutorial_continue',
]) {
  const result = handleTutorialEvent(state, event);
  assert.equal(result.changed, true, `核心事件應推進：${event}`);
}
assert.equal(state.tutorial.onboarding, 'complete');
assert.equal(currentTutorialStep(state), null);

handleTutorialEvent(state, 'office_opened');
assert.equal(state.tutorial.activeContextModuleId, 'quest');
assert.equal(currentTutorialStep(state)?.id, 'quest_intro');
handleTutorialEvent(state, 'tutorial_continue');
assert.equal(currentTutorialStep(state)?.id, 'quest_accept');
handleTutorialEvent(state, 'quest_accepted');
assert.equal(state.tutorial.activeContextModuleId, null);
assert.equal(tutorialModuleStatus(state, tutorialModule('quest')), '已完成');

handleTutorialEvent(state, 'battle_started');
assert.equal(state.tutorial.activeContextModuleId, 'battle');
assert.equal(skipTutorialModule(state, 'battle'), true);
assert.equal(state.tutorial.activeContextModuleId, null);
assert.equal(tutorialModuleStatus(state, tutorialModule('battle')), '已跳過');

const oldState = newGame('peter');
oldState.tutorial.onboarding = 'legacy';
oldState.tutorial.tipsEnabled = false;
handleTutorialEvent(oldState, 'office_opened');
assert.equal(oldState.tutorial.activeContextModuleId, null);
assert.equal(enableContextTutorials(oldState), true);
assert.equal(oldState.tutorial.onboarding, 'complete');
handleTutorialEvent(oldState, 'office_opened');
assert.equal(oldState.tutorial.activeContextModuleId, 'quest');

const skipped = newGame('chiyo');
assert.equal(skipTutorialModule(skipped, 'core'), true);
assert.equal(skipped.tutorial.onboarding, 'skipped');
handleTutorialEvent(skipped, 'mates_opened');
assert.equal(skipped.tutorial.activeContextModuleId, 'mates');

const legacyV22 = newGame('lin');
legacyV22.version = 22;
delete legacyV22.tutorial;
localStorage.setItem('seagame_save_slot3', JSON.stringify(legacyV22));
const migrated = loadGame(3);
assert.ok(migrated);
assert.equal(migrated.version, 23);
assert.equal(migrated.tutorial.onboarding, 'legacy');
assert.equal(migrated.tutorial.tipsEnabled, false);
assert.equal(migrated.story.heroId, 'lin');

console.log('tutorial engine and v23 migration tests passed');