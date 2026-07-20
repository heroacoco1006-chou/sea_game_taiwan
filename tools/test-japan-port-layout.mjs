import assert from 'node:assert/strict';
import layouts from '../src/data/portTownLayouts.json' with { type: 'json' };

const expected = {
  tavern: [650, 410, 650, 436],
  inn: [1280, 390, 1280, 417],
  office: [1600, 390, 1600, 415],
  trade: [650, 610, 650, 638],
  item: [1560, 610, 1560, 635],
};

const facilities = new Map(layouts.layouts.japan.facilities.map((facility) => [facility.key, facility]));
for (const [key, position] of Object.entries(expected)) {
  const facility = facilities.get(key);
  assert.ok(facility, `日本港町缺少 ${key}`);
  assert.deepEqual(
    [facility.x, facility.y, facility.doorX, facility.doorY],
    position,
    `日本港町 ${key} 必須維持原始標記圖箭頭所指位置`,
  );
}

console.log(`japan port marker tests passed (${Object.keys(expected).length} facilities)`);
