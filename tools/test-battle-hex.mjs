// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/test-battle-hex.mjs
import assert from 'node:assert/strict';

const hex = await import('../src/battle/hex.ts');
let cases = 0;
const test = (name, run) => {
  run();
  cases += 1;
  console.log(`✓ ${name}`);
};

test('原點依固定 facing 順序產生 6 個唯一鄰居', () => {
  const actual = hex.hexNeighbors({ q: 0, r: 0 });
  assert.deepEqual(actual, [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
  ]);
  assert.equal(new Set(actual.map(hex.hexKey)).size, 6);
});

test('單一方向鄰居與 facing 0..5 一致', () => {
  for (let facing = 0; facing < 6; facing += 1) {
    assert.deepEqual(hex.hexNeighbor({ q: 3, r: 2 }, facing), hex.hexNeighbors({ q: 3, r: 2 })[facing]);
  }
});

test('hex distance 對稱且符合固定案例', () => {
  const samples = [
    [{ q: 0, r: 0 }, { q: 0, r: 0 }, 0],
    [{ q: 0, r: 0 }, { q: 3, r: -2 }, 3],
    [{ q: -2, r: 5 }, { q: 4, r: 1 }, 6],
    [{ q: 10, r: 6 }, { q: 0, r: 0 }, 16],
  ];
  for (const [a, b, expected] of samples) {
    assert.equal(hex.hexDistance(a, b), expected);
    assert.equal(hex.hexDistance(b, a), expected);
  }
});

test('axial 中心點可完整往返 pixel，含自訂原點與負座標', () => {
  const origin = { x: 137, y: 83 };
  for (const axial of [{ q: 0, r: 0 }, { q: 3, r: 2 }, { q: -4, r: 5 }, { q: 10, r: -6 }]) {
    assert.deepEqual(hex.pixelToAxial(hex.axialToPixel(axial, 48, origin), 48, origin), axial);
  }
});

test('pixelToAxial 會選擇最近的六角格', () => {
  const center = hex.axialToPixel({ q: 2, r: 3 }, 60);
  assert.deepEqual(hex.pixelToAxial({ x: center.x + 8, y: center.y - 7 }, 60), { q: 2, r: 3 });
  const neighbor = hex.axialToPixel({ q: 3, r: 3 }, 60);
  assert.deepEqual(hex.pixelToAxial({ x: neighbor.x - 6, y: neighbor.y + 5 }, 60), { q: 3, r: 3 });
});

test('無效 hex size 回傳穩定錯誤', () => {
  assert.throws(() => hex.axialToPixel({ q: 0, r: 0 }, 0), /HEX_SIZE_MUST_BE_POSITIVE/);
  assert.throws(() => hex.pixelToAxial({ x: 0, y: 0 }, -1), /HEX_SIZE_MUST_BE_POSITIVE/);
});

test('11×7 地圖邊界只接受整數且不越界', () => {
  assert.equal(hex.hexInBounds({ q: 0, r: 0 }, 11, 7), true);
  assert.equal(hex.hexInBounds({ q: 10, r: 6 }, 11, 7), true);
  assert.equal(hex.hexInBounds({ q: 11, r: 6 }, 11, 7), false);
  assert.equal(hex.hexInBounds({ q: 10, r: 7 }, 11, 7), false);
  assert.equal(hex.hexInBounds({ q: -1, r: 0 }, 11, 7), false);
  assert.equal(hex.hexInBounds({ q: 1.5, r: 2 }, 11, 7), false);
});

test('hex line 含起終點、長度正確且每一步相鄰', () => {
  const start = { q: 0, r: 0 };
  const end = { q: 3, r: -2 };
  const line = hex.hexLine(start, end);
  assert.deepEqual(line[0], start);
  assert.deepEqual(line[line.length - 1], end);
  assert.equal(line.length, hex.hexDistance(start, end) + 1);
  for (let i = 1; i < line.length; i += 1) assert.equal(hex.hexDistance(line[i - 1], line[i]), 1);
});

test('hex line 固定直線案例不漂移', () => {
  assert.deepEqual(hex.hexLine({ q: 1, r: 1 }, { q: 5, r: 1 }), [
    { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 }, { q: 5, r: 1 },
  ]);
  assert.deepEqual(hex.hexLine({ q: 2, r: 2 }, { q: 2, r: 2 }), [{ q: 2, r: 2 }]);
});
test('11×7 全地圖任意兩格畫線皆連續且不越界', () => {
  const cells = [];
  for (let q = 0; q < 11; q += 1) for (let r = 0; r < 7; r += 1) cells.push({ q, r });
  for (const start of cells) {
    for (const end of cells) {
      const line = hex.hexLine(start, end);
      assert.deepEqual(line[0], start);
      assert.deepEqual(line[line.length - 1], end);
      assert.equal(line.length, hex.hexDistance(start, end) + 1);
      assert.equal(new Set(line.map(hex.hexKey)).size, line.length);
      for (const cell of line) assert.equal(hex.hexInBounds(cell, 11, 7), true);
      for (let i = 1; i < line.length; i += 1) assert.equal(hex.hexDistance(line[i - 1], line[i]), 1);
    }
  }
});

console.log(`\n✅ P1 六角格數學固定案例 ${cases} 組全部通過`);
