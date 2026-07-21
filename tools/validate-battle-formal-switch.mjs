import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [config, main, world, legacy, book, p9] = await Promise.all([
  read('src/battle/battleConfig.ts'),
  read('src/main.ts'),
  read('src/scenes/WorldMapScene.ts'),
  read('src/scenes/BattleScene.ts'),
  read('docs/2026-06-12_大航海福爾摩沙_遊戲建構書.md'),
  read('docs/2026-07-15_P9_六角格海戰總驗收清單.md'),
]);

assert.match(config, /USE_HEX_BATTLE\s*=\s*true/);
assert.match(config, /requestedBattle === 'legacy'/);
assert.match(config, /requestedBattle === 'hex'/);
assert.match(main, /BattleScene, BattleHexScene/);
assert.match(world, /battleSceneKey\(\)/);
assert.doesNotMatch(world, /this\.scene\.start\('Battle'/);
assert.match(legacy, /super\('Battle'\)/);
assert.match(book, /11×7 六角格戰場/);
assert.match(book, /玩家實際擁有的 1～5 艘船/);
assert.match(book, /12 回合/);
assert.match(book, /1\.5 倍/);
assert.match(p9, /22 項全數通過/);

console.log('PASS: BattleHex is the formal default and legacy Battle remains available.');
