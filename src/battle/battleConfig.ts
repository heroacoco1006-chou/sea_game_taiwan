export const USE_HEX_BATTLE = false;

export function battleSceneKey(): 'Battle' | 'BattleHex' {
  return USE_HEX_BATTLE ? 'BattleHex' : 'Battle';
}
