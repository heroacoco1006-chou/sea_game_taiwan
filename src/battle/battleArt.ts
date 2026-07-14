// P8 六角格海戰 runtime 素材 URL 索引。
// import.meta.glob 只把 URL 納入 build；實際 PNG 由 BattleHexScene.preload() 進場時下載。

type UrlMap = Record<string, string>;

function byBaseName(glob: Record<string, string>): UrlMap {
  const result: UrlMap = {};
  for (const path in glob) {
    const base = path.split('/').pop()!.replace(/\.png$/i, '');
    result[base] = glob[path];
  }
  return result;
}

export const BATTLE_HEX_SHIP_SHEET_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/ships/sheets/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_TERRAIN_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/terrain/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_ISLAND_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/islands/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_EFFECT_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/effects/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_COMMAND_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/ui/commands/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_OVERLAY_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/ui/overlays/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const BATTLE_HEX_MARKER_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/battle-hex/runtime/ui/markers/*.png', {
    eager: true, query: '?url', import: 'default',
  }) as Record<string, string>,
);

export const battleHexShipKey = (id: string): string => `battlehex_ship_${id}`;
export const battleHexTerrainKey = (id: string): string => `battlehex_terrain_${id}`;
export const battleHexIslandKey = (id: string): string => `battlehex_island_${id}`;
export const battleHexEffectKey = (id: string): string => `battlehex_effect_${id}`;
export const battleHexCommandKey = (id: string): string => `battlehex_command_${id}`;
export const battleHexOverlayKey = (id: string): string => `battlehex_overlay_${id}`;
export const battleHexMarkerKey = (id: string): string => `battlehex_marker_${id}`;

export const BATTLE_HEX_ISLAND_IDS = [
  'palm_islet', 'rocky_island', 'twin_island',
  'crescent_reef', 'bare_rocks', 'mangrove_islet',
] as const;
