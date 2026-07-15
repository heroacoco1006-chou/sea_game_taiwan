import assert from 'node:assert/strict';
import {
  MIN_TOUCH_TARGET_CSS_PX,
  fittedCanvasCssSize,
  isCompactBattleCanvas,
  minimumLogicalTouchTarget,
} from '../src/touchTargets.ts';

const EPSILON = 0.0001;

function verifyViewport(name, viewportWidth, viewportHeight, expectedCompact) {
  const canvas = fittedCanvasCssSize(viewportWidth, viewportHeight);
  const target = minimumLogicalTouchTarget(canvas.width, canvas.height);
  assert.equal(isCompactBattleCanvas(canvas.width, canvas.height), expectedCompact, `${name}: compact mode`);
  assert.ok(target.width * target.scaleX + EPSILON >= MIN_TOUCH_TARGET_CSS_PX, `${name}: width`);
  assert.ok(target.height * target.scaleY + EPSILON >= MIN_TOUCH_TARGET_CSS_PX, `${name}: height`);
  return {
    name,
    canvas: `${canvas.width.toFixed(2)}x${canvas.height.toFixed(2)}`,
    logicalTarget: `${target.width}x${target.height}`,
    cssTarget: `${(target.width * target.scaleX).toFixed(2)}x${(target.height * target.scaleY).toFixed(2)}`,
    compact: expectedCompact,
  };
}

const results = [
  verifyViewport('desktop', 1280, 720, false),
  verifyViewport('ipad-landscape', 1180, 820, false),
  verifyViewport('phone-landscape', 844, 390, true),
  verifyViewport('iphone-se-landscape', 568, 320, true),
];

const fallback = minimumLogicalTouchTarget(0, Number.NaN, 0);
assert.equal(fallback.width, 44);
assert.equal(fallback.height, 44);

console.table(results);
console.log('PASS: battle touch targets remain at least 44 CSS px.');
