import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

const rootBlock = html.match(/:root\s*\{([\s\S]*?)\}/);
const gameBlock = html.match(/#game\s*\{([\s\S]*?)\}/);

assert.ok(rootBlock, '找不到 :root 安全區設定');
assert.ok(gameBlock, '找不到 #game CSS 規則');
assert.match(html, /name="viewport"[^>]+viewport-fit=cover/, 'iPhone 需要 viewport-fit=cover');
assert.match(main, /autoCenter:\s*Phaser\.Scale\.CENTER_BOTH/, 'Phaser 必須保留唯一置中來源');
assert.match(rootBlock[1], /--safe-x:[\s\S]*safe-area-inset-left/, 'safe-x 缺少左安全區');
assert.match(rootBlock[1], /--safe-x:[\s\S]*safe-area-inset-right/, 'safe-x 缺少右安全區');
assert.match(rootBlock[1], /--safe-y:[\s\S]*safe-area-inset-top/, 'safe-y 缺少上安全區');
assert.match(rootBlock[1], /--safe-y:[\s\S]*safe-area-inset-bottom/, 'safe-y 缺少下安全區');
assert.doesNotMatch(gameBlock[1], /display:\s*flex/, '#game 不可用 flex 重複置中');
assert.doesNotMatch(gameBlock[1], /justify-content\s*:/, '#game 不可水平重複置中');
assert.doesNotMatch(gameBlock[1], /align-items\s*:/, '#game 不可垂直重複置中');
assert.match(gameBlock[1], /position:\s*fixed/, '#game 必須填滿安全視窗');
assert.match(gameBlock[1], /inset:\s*var\(--safe-y\)\s+var\(--safe-x\)/, '#game 必須使用對稱安全區');

console.log('PASS: mobile canvas uses one centering source and symmetric iPhone safe areas.');
