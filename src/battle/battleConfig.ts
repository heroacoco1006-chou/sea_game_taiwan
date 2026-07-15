export const USE_HEX_BATTLE = true;

export function battleSceneKey(): 'Battle' | 'BattleHex' {
  const requestedBattle = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('battle')
    : null;

  if (requestedBattle === 'legacy') return 'Battle';
  return USE_HEX_BATTLE || requestedBattle === 'hex' ? 'BattleHex' : 'Battle';
}
