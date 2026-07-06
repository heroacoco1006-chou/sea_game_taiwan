// V2 美術素材的執行時 URL 對照表。
// 素材檔放在專案根目錄 `assets/m5/v2/`（非 public/），用 Vite 的 import.meta.glob
// 在 build 與 dev 都產生正確的 URL；檔名（去副檔名）即為對照 key。
// - 角色頭像：key = 主角／夥伴 id（lin、chiyo、zheng_zhilong…）
// - 船隻 sprite：key = 船型 id（junk_small、galleon…）；世界地圖方向幀另用 shipwd_
// - 船卡／船隻裝備：key = 船型 id／裝備 id
// - 主角行走圖：key = 主角 id（lin、peter、chiyo），7 格 spritesheet
// - M5-2 世界／港町素材：key = 檔名（full_map_v3、full_map_v2、sea_chart、han_item_shop、han_trade、unknown_exploration…）
// - 港町高精緻底圖：key = 檔名（anhai-town-bg-v1…）
// - 劇情背景：key = 檔名（lin_story_bg、peter_story_bg、chiyo_story_bg）
// - 圖鑑插圖：key = 圖鑑 entry id（codex_lin_1_0、sp_swinhoe_frog…）

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

export const SHIP_WORLD_DIRECTIONAL_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/world_directional/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const SHIP_BATTLE_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/battle/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const SHIP_CARD_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/cards/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const CHARACTER_WALK_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/characters/walk/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const SHIP_EQUIPMENT_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/ships/equipment/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const WORLD_ART_URLS = byBaseName({
  ...import.meta.glob('/assets/m5/v2/m5-2/world/full_map_v3.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('/assets/m5/v2/m5-2/world/full_map_v3_preview.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('/assets/m5/v2/m5-2/world/full_map_v2.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('/assets/m5/v2/m5-2/world/full_map_v2_preview.png', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>);

export const PORT_BUILDING_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/ports/buildings/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const PORT_TOWN_BUILDING_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/ports/town-buildings/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const PORT_TOWN_BACKGROUND_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/ports/town-backgrounds/*-town-bg-v1.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const HARBOR_SCENE_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/ports/harbors/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const EXPLORATION_ICON_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/exploration/icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const FACILITY_ICON_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-2/ui/icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);
export const STORY_BACKGROUND_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/story/backgrounds/*_story_bg.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);
// 各章專屬劇情背景：放在 `<hero>-chapters/`，檔名 `<hero>_chNN_xxx.png`（千代、彼得…，林線日後補也自動生效）。
export const STORY_CHAPTER_BG_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/story/backgrounds/*-chapters/*_ch*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

export const CODEX_ILLUSTRATION_URLS = byBaseName(
  import.meta.glob('/assets/m5/v2/m5-4/codex/illustrations/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
);

// 入口（標題）畫面背景圖（夕陽港灣）。
export const TITLE_BG_URL: string | undefined = (
  import.meta.glob('/assets/m5/login_001.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
)['/assets/m5/login_001.png'];

/** Phaser 材質 key 命名（避免和程式生成的材質撞名） */
export const portraitKey = (id: string): string => `portrait_${id}`;
export const shipWorldKey = (typeId: string): string => `shipw_${typeId}`;
export const shipWorldDirectionalKey = (typeId: string): string => `shipwd_${typeId}`;
export const shipBattleKey = (typeId: string): string => `shipb_${typeId}`;
export const shipCardKey = (typeId: string): string => `shipc_${typeId}`;
export const characterWalkKey = (heroId: string): string => `walk_${heroId}`;
export const shipEquipmentKey = (id: string): string => `shipeq_${id}`;
export const worldArtKey = (id: string): string => `m5w_${id}`;
export const portBuildingKey = (id: string): string => `m5b_${id}`;
export const portTownBuildingKey = (id: string): string => `m5tb_${id}`;
export const portTownBackgroundKey = (id: string): string => `m5town_${id}`;
export const harborSceneKey = (id: string): string => `m5h_${id}`;
export const explorationIconKey = (id: string): string => `m5x_${id}`;
export const facilityIconKey = (id: string): string => `m5u_${id}`;
export const storyBackgroundKey = (id: string): string => `storybg_${id}`;
export const storyChapterBgKey = (heroId: string, chapter: number): string => `storybgch_${heroId}_${chapter}`;
/** 由章節背景檔名（如 chiyo_ch01_xxx）正規化為「材質 key → url」，供 BootScene 預載。 */
export const STORY_CHAPTER_BG_BY_KEY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const base in STORY_CHAPTER_BG_URLS) {
    const m = base.match(/^([a-z]+)_ch(\d+)_/);
    if (m) out[storyChapterBgKey(m[1], parseInt(m[2], 10))] = STORY_CHAPTER_BG_URLS[base];
  }
  return out;
})();
/** 只回傳指定章節背景 URL；由 StoryScene 在進場前按需載入。 */
export const storyChapterBgUrl = (heroId: string, chapter: number): string | undefined =>
  STORY_CHAPTER_BG_BY_KEY[storyChapterBgKey(heroId, chapter)];
export const codexIllustrationKey = (id: string): string => `codeximg_${id}`;
/** 只回傳指定圖鑑插圖 URL；由 InfoScene 開啟詳情時按需載入。 */
export const codexIllustrationUrl = (id: string): string | undefined => CODEX_ILLUSTRATION_URLS[id];
