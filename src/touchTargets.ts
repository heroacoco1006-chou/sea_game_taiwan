export const MIN_TOUCH_TARGET_CSS_PX = 44;
export const COMPACT_BATTLE_SCALE_THRESHOLD = 0.75;

export interface CssSize {
  width: number;
  height: number;
}

export interface LogicalTouchTarget extends CssSize {
  scaleX: number;
  scaleY: number;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * 以 Scale.FIT 的規則計算實際 canvas CSS 尺寸。安全區 padding 已由呼叫端先扣除。
 */
export function fittedCanvasCssSize(
  viewportWidth: number,
  viewportHeight: number,
  baseWidth = 1280,
  baseHeight = 720,
): CssSize {
  const safeBaseWidth = positiveOr(baseWidth, 1280);
  const safeBaseHeight = positiveOr(baseHeight, 720);
  const safeViewportWidth = positiveOr(viewportWidth, safeBaseWidth);
  const safeViewportHeight = positiveOr(viewportHeight, safeBaseHeight);
  const scale = Math.min(safeViewportWidth / safeBaseWidth, safeViewportHeight / safeBaseHeight);
  return {
    width: safeBaseWidth * scale,
    height: safeBaseHeight * scale,
  };
}

/**
 * 把 WCAG／行動裝置要求的 CSS px 反算成遊戲邏輯 px。
 * runtime 應傳入 canvas.getBoundingClientRect()，因此已包含 FIT 與安全區影響。
 */
export function minimumLogicalTouchTarget(
  canvasCssWidth: number,
  canvasCssHeight: number,
  minCssPx = MIN_TOUCH_TARGET_CSS_PX,
  baseWidth = 1280,
  baseHeight = 720,
): LogicalTouchTarget {
  const safeBaseWidth = positiveOr(baseWidth, 1280);
  const safeBaseHeight = positiveOr(baseHeight, 720);
  const safeCssWidth = positiveOr(canvasCssWidth, safeBaseWidth);
  const safeCssHeight = positiveOr(canvasCssHeight, safeBaseHeight);
  const safeMinCssPx = positiveOr(minCssPx, MIN_TOUCH_TARGET_CSS_PX);
  const scaleX = safeCssWidth / safeBaseWidth;
  const scaleY = safeCssHeight / safeBaseHeight;
  return {
    width: Math.ceil(safeMinCssPx / scaleX),
    height: Math.ceil(safeMinCssPx / scaleY),
    scaleX,
    scaleY,
  };
}

export function isCompactBattleCanvas(
  canvasCssWidth: number,
  canvasCssHeight: number,
  baseWidth = 1280,
  baseHeight = 720,
): boolean {
  const target = minimumLogicalTouchTarget(
    canvasCssWidth,
    canvasCssHeight,
    MIN_TOUCH_TARGET_CSS_PX,
    baseWidth,
    baseHeight,
  );
  return Math.min(target.scaleX, target.scaleY) < COMPACT_BATTLE_SCALE_THRESHOLD;
}
