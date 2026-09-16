import type { TownGroundPoint } from './types';

/** 把 Phaser 超取樣後的 canvas 座標還原成港町 1280x720 邏輯座標。 */
export function townViewportPoint(
  pointerX: number,
  pointerY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): TownGroundPoint {
  const scaleX = canvasWidth > 0 ? viewportWidth / canvasWidth : 1;
  const scaleY = canvasHeight > 0 ? viewportHeight / canvasHeight : 1;
  return { u: pointerX * scaleX, v: pointerY * scaleY };
}
