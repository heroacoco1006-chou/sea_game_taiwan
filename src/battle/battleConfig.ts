export const USE_HEX_BATTLE = false;

export function battleSceneKey(): 'Battle' | 'BattleHex' {
  const developmentOverride = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('battle') === 'hex';
  return USE_HEX_BATTLE || developmentOverride ? 'BattleHex' : 'Battle';
}
