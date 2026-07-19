/** 玩家可見的遊戲版本；發版時與 package.json、VERSION.md 及 Git tag 同步更新。 */
export const GAME_VERSION = '2.0.0';
export const GAME_VERSION_NAME = '六角海戰版';

export function gameVersionLabel(): string {
  return `V${GAME_VERSION}｜${GAME_VERSION_NAME}`;
}
