import assert from 'node:assert/strict';
import { worldShipDirectionFrame } from '../src/worldShipDirection.ts';

const cases = [
  { name: '向右', dx: 1, dy: 0, frame: 3 },
  { name: '向左', dx: -1, dy: 0, frame: 2 },
  { name: '向下', dx: 0, dy: 1, frame: 0 },
  { name: '向上', dx: 0, dy: -1, frame: 1 },
  { name: '斜右下（垂直為主）', dx: 1, dy: 2, frame: 0 },
  { name: '斜左上（垂直為主）', dx: -1, dy: -2, frame: 1 },
];

for (const testCase of cases) {
  assert.equal(
    worldShipDirectionFrame(testCase.dx, testCase.dy),
    testCase.frame,
    `${testCase.name}應使用 frame ${testCase.frame}`,
  );
}

console.log(`world ship direction tests passed (${cases.length} cases)`);
