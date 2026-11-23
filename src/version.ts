/** 玩家可見的遊戲版本；發版時與 package.json、VERSION.md 及 Git tag 同步更新。 */
export const GAME_VERSION = '2.6.0';
export const GAME_VERSION_NAME = '友善領航與海戰親民版';

export function gameVersionLabel(): string {
  return `V${GAME_VERSION}｜${GAME_VERSION_NAME}`;
}
