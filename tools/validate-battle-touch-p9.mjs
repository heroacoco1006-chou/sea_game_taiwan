import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [scene, ui, targets, flags] = await Promise.all([
  readFile(new URL('../src/scenes/BattleHexScene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/touchTargets.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/battleConfig.ts', import.meta.url), 'utf8'),
]);

assert.match(targets, /MIN_TOUCH_TARGET_CSS_PX\s*=\s*44/);
assert.match(targets, /COMPACT_BATTLE_SCALE_THRESHOLD\s*=\s*0\.75/);
assert.match(ui, /getBoundingClientRect\(\)/);
assert.match(ui, /setMinimumCssTouchTarget/);
assert.match(scene, /this\.scale\.on\('resize', this\.layoutBattleTouchControls, this\)/);
assert.match(scene, /this\.scale\.off\('resize', this\.layoutBattleTouchControls, this\)/);
assert.match(scene, /__battleHexTouchAudit/);
assert.match(scene, /compact && Boolean\(this\.launch\)/);
assert.match(flags, /USE_HEX_BATTLE\s*=\s*true/);
assert.match(flags, /requestedBattle === 'legacy'/);

for (const id of [
  'turn-left', 'turn-right', 'cancel', 'confirm', 'cannon', 'board', 'repair',
  'wait', 'end-turn', 'auto-battle', 'take-control', 'return', 'retreat',
]) {
  assert.ok(scene.includes(`id: '${id}'`), `missing control registration: ${id}`);
}
assert.match(scene, /id: `map:\$\{map\.id\}`/);

console.log('PASS: P9 battle touch wiring and feature-flag guard are complete.');
