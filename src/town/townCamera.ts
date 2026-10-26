import type { TownGroundPoint, TownMovementInput } from './types';

export interface TownCameraBasis {
  right: TownGroundPoint;
  forward: TownGroundPoint;
}

/** 固定斜俯視鏡頭在地面的畫面軸：right 是畫面右方，forward 是畫面上方。 */
export function townCameraBasis(yawDeg: number): TownCameraBasis {
  const yaw = yawDeg * Math.PI / 180;
  return {
    right: { u: Math.cos(yaw), v: -Math.sin(yaw) },
    forward: { u: -Math.sin(yaw), v: -Math.cos(yaw) },
  };
}

/** 把方向鍵／觸控的畫面方向轉成地面方向，避免斜鏡頭下上下左右顛倒。 */
export function screenMovementToGround(input: TownMovementInput, yawDeg: number): TownMovementInput {
  const basis = townCameraBasis(yawDeg);
  return {
    x: basis.right.u * input.x - basis.forward.u * input.y,
    y: basis.right.v * input.x - basis.forward.v * input.y,
  };
}

/** 將地面移動反投影回畫面軸，供方向與鏡頭測試使用。 */
export function groundMovementToScreen(input: TownMovementInput, yawDeg: number): TownMovementInput {
  const basis = townCameraBasis(yawDeg);
  return {
    x: basis.right.u * input.x + basis.right.v * input.y,
    y: -(basis.forward.u * input.x + basis.forward.v * input.y),
  };
}

/** 鏡頭略看向角色前方，使角色落在畫面下半部並保留行走視野。 */
export function townCameraFollowTarget(
  player: TownGroundPoint,
  yawDeg: number,
  lookAhead: number,
): TownGroundPoint {
  const { forward } = townCameraBasis(yawDeg);
  return {
    u: player.u + forward.u * lookAhead,
    v: player.v + forward.v * lookAhead,
  };
}
