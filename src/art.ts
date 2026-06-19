// V2 美術素材的執行時 URL 對照表。
// 素材檔放在專案根目錄 `assets/m5/v2/`（非 public/），用 Vite 的 import.meta.glob
// 在 build 與 dev 都產生正確的 URL；檔名（去副檔名）即為對照 key。
// - 角色頭像：key = 主角／夥伴 id（lin、chiyo、zheng_zhilong…）
// - 船隻 sprite：key = 船型 id（junk_small、galleon…）

type UrlMap = Record<string, string>;

function byBaseName(glob: Record<string, string>): UrlMap {
  const out: UrlMap = {};
  for (const path in glob) {
    const base = path.split('/').pop()!.replace(/\.png$/i, '');
    out[base] = glob[path];
  }
  return out;
}

export const PORTRAIT_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/characters/portraits/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const SHIP_WORLD_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/world/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const SHIP_BATTLE_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/battle/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

/** Phaser 材質 key 命名（避免和程式生成的材質撞名） */
export const portraitKey = (id: string): string => `portrait_${id}`;
export const shipWorldKey = (typeId: string): string => `shipw_${typeId}`;
export const shipBattleKey = (typeId: string): string => `shipb_${typeId}`;
