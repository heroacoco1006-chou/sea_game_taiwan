import goodsData from './data/goods.json';
import portsData from './data/ports.json';
import mapData from './data/map.json';
import shipsData from './data/ships.json';
import equipData from './data/equipment.json';
import matesData from './data/mates.json';
import storyData from './data/story.json';
import explorationData from './data/exploration_points.json';
import discoveriesData from './data/discoveries.json';
import codexData from './data/codex.json';
import mapReanchorV3Data from './data/map_reanchor_v3.json';
import { chapterCodexIds, getChapterScript } from './story/parseStory';
export { getChapterScript, getMateScript } from './story/parseStory';
export type { ParsedChapter, StoryLine } from './story/parseStory';

export interface Good {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  color: string;
  desc: string;
}

export interface Port {
  id: string;
  name: string;
  x: number;
  y: number;
  region: string;
  culture: string;
  shipyard: boolean;
  desc: string;
  cheap: string[];
  dear: string[];
  /** 本港販售的商品（5~7 種，含特產）；賣出則不限品項 */
  sells: string[];
  /** 今地名（給港口介紹，特別是古地名港口） */
  modern: string;
}

export interface Land {
  name: string;
  points: number[][];
}

export interface MapLabel {
  text: string;
  x: number;
  y: number;
  size: number;
}

/** 行情事件：某港某貨需求大增，價格上漲 */
export interface MarketEvent {
  portId: string;
  goodId: string;
  untilDay: number;
}

export interface ShipType {
  id: string;
  name: string;
  origin: string;
  price: number;
  /** 總空間（固定）＝商品艙＋糧水艙 */
  space: number;
  /** 航速倍率 */
  speed: number;
  hullMax: number;
  cannonSlots: number;
  /** 低於最低水手數航速減半；低於一半變最慢 */
  minCrew: number;
  maxCrew: number;
  desc: string;
}

/** 採購／運送委託 */
export interface DeliveryQuest {
  type: 'delivery';
  goodId: string;
  qty: number;
  portId: string;
  deadlineDay: number;
  reward: number;
  originPortId?: string;
}

/** 海戰委託：接取後世界地圖會出現海盜標記 */
export interface CombatQuest {
  type: 'combat';
  title: string;
  originPortId: string;
  targetX: number;
  targetY: number;
  deadlineDay: number;
  reward: number;
  enemyTier: number;
  completed: boolean;
  codexIds: string[];
}

/** 探索委託：前往探索點調查 */
export interface ExplorationQuest {
  type: 'exploration';
  title: string;
  originPortId: string;
  pointId: string;
  deadlineDay: number;
  reward: number;
  completed: boolean;
  codexIds: string[];
}

export type Quest = DeliveryQuest | CombatQuest | ExplorationQuest;

export interface PlayerShip {
  typeId: string;
  x: number;
  y: number;
  hull: number;
  /** 已安裝砲數（≤ 船型砲位） */
  cannons: number;
  /** 商品艙空間（＝貨艙上限） */
  cargoSpace: number;
  /** 糧水艙空間（＝糧上限＝水上限） */
  supplySpace: number;
  /** 船首像 id（提升能力），無則 null */
  figurehead: string | null;
  /** 裝甲 id（船體耐久↑、抗暴風），無則 null */
  armor: string | null;
  /** 船帆 id（航速↑、抗暴風），無則 null */
  sail: string | null;
  /** 大砲種類 id（海戰火力倍率），無則 null */
  cannonType: string | null;
}

/** 造船廠建造中的船 */
export interface ShipOrder {
  id: string;
  typeId: string;
  portId: string;
  mode: 'flagship' | 'escort';
  orderedDay: number;
  readyDay: number;
  paid: number;
}

/** 個人裝備（主角） */
export interface Equip {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

/** 已招募的夥伴與其職位 */
export interface Mate {
  id: string;
  role: string | null;
}

export interface RoleDef { key: string; name: string; desc: string; }
export interface MateRequirement {
  heroIds?: HeroId[];
  minChapter?: number;
  maxChapter?: number;
  gold?: number;
  cargo?: Array<{ goodId: string; qty: number }>;
  discoveredExplorationPoints?: string[];
  codexIds?: string[];
  /** 聲望門檻（v18 聲望系統）：各軌道需達到的數值 */
  reputation?: Partial<Record<RepKind, number>>;
  /** 部族／勢力友好度門檻，key＝勢力 id（如 sinckan 新港社） */
  friendship?: Record<string, number>;
  /** 船長六圍能力值門檻（沿用既有等級系統） */
  stats?: Partial<Record<StatKey, number>>;
  /** 需造訪過的港口 id */
  visitPorts?: string[];
  /** 累積賣出貨物總額（全域，兩） */
  tradeTotal?: number;
  /** 在指定港口累積賣出貨物額（兩） */
  tradeAtPort?: { portId: string; min: number };
  /** 海戰勝利次數 */
  battleWins?: number;
}
export interface MateQuestStage {
  title: string;
  desc: string;
  requirement?: MateRequirement;
  /** 這一段需要回到夥伴所在港「回報」才算完成（對話類），不自動達成 */
  reportAtPort?: boolean;
  /** 回報時交付（扣除）requirement.cargo 指定的貨物 */
  consumeCargo?: boolean;
  /** 海上決鬥：輪到此階段時，出海航行會遇到對方船隊，海戰擊敗後完成（例：劉香） */
  duel?: { name: string; tier: number };
}
/** 夥伴專屬任務的持久化進度：接下後寫入存檔；已完成的階段永久鎖存，不因資金貨物變動倒退。 */
export interface MateQuestProgress {
  status: 'active' | 'done';
  stagesDone: boolean[];
  acceptedDay: number;
}
/** 三軌聲望（v18）：冒險名聲／商人聲望／海上威名 */
export type RepKind = 'adventure' | 'trade' | 'valor';
export interface ReputationState { adventure: number; trade: number; valor: number; }
export const REP_NAMES: Record<RepKind, string> = { adventure: '冒險名聲', trade: '商人聲望', valor: '海上威名' };
export const FACTION_NAMES: Record<string, string> = { sinckan: '新港社' };
/** 客座夥伴設定：主線推進到 leaveAfterChapter 之後會自動離隊（限定章節同行，不影響史實結局）。 */
export interface MateGuest {
  leaveAfterChapter: number;
  leaveText: string;
}
export interface MateDef {
  id: string;
  name: string;
  from: string;
  portId: string;
  fee: number;
  star: number;
  history: string;
  roles: string[];
  desc: string;
  questTitle: string;
  requirement?: MateRequirement;
  questStages?: MateQuestStage[];
  codexBody: string;
  guest?: MateGuest;
  stats?: Partial<Stats>; // 可選手動微調，覆蓋規則產生的能力值
}

export interface WeaponItem { id: string; name: string; price: number; board: number; desc: string; }
export interface ArmorItem { id: string; name: string; price: number; defense: number; desc: string; }
export interface AccessoryItem { id: string; name: string; price: number; effect: string; desc: string; }
export interface FigureheadItem { id: string; name: string; price: number; effect: string; desc: string; }
export interface ConsumableItem { id: string; name: string; price: number; effect: string; desc: string; }
// 船隻裝備（旗艦）：裝甲、船帆、大砲種類
export interface HullPlatingItem { id: string; name: string; price: number; hullBonus: number; stormReduce: number; desc: string; }
export interface SailItem { id: string; name: string; price: number; speedBonus: number; stormReduce: number; desc: string; }
export interface CannonTypeItem { id: string; name: string; price: number; power: number; board: number; desc: string; }

export type ShopCat = 'weapon' | 'armor' | 'accessory' | 'consumable';
export type SeaStatusId = 'storm' | 'rats' | 'scurvy' | 'mutiny' | 'homesick';
export type HeroId = 'lin' | 'peter' | 'chiyo';

export interface SeaStatus {
  id: SeaStatusId;
  days: number;
}

// ---------- 能力值與等級 ----------
export type StatKey = 'lead' | 'gun' | 'val' | 'nav' | 'kno' | 'neg';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ['lead', 'gun', 'val', 'nav', 'kno', 'neg'];
export const STAT_NAMES: Record<StatKey, string> = {
  lead: '統率', gun: '砲術', val: '武勇', nav: '航海', kno: '知識', neg: '交涉',
};
export const LEVEL_CAP = 50;

export interface CaptainState {
  level: number;
  xp: number;
  stats: Stats;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  role: string;
  startYear: number;
  startPortId: string;
  startShipTypeId: string;
  startGold: number;
  startCrew: number;
  intro: string;
  routeFocus: string;
  baseStats?: Stats; // Lv1 起始六圍
  aptitude?: Stats; // 成長傾向權重
}

export interface StoryChapter {
  id: string;
  heroId: HeroId;
  chapter: number;
  title: string;
  year: number;
  targetPortId: string;
  npc: string;
  objective: string;
  requirements?: StoryRequirements;
  rewardGold: number;
  // 對白與圖鑑解鎖內容來自 data/story/*.md（見 src/story/parseStory.ts）
}

export interface StoryRequirements {
  cargo?: Array<{
    goodId: string;
    qty: number;
    consume?: boolean;
  }>;
}

export interface CodexEntry {
  id: string;
  category?: string;
  type: string;
  title: string;
  short?: string;
  body: string;
  whyImportant?: string;
  kidNote?: string;
  relatedIds?: string[];
  unlockHint?: string;
  source?: string;
}

export interface CodexCategory {
  id: string;
  label: string;
  desc: string;
}

export interface CodexListEntry extends CodexEntry {
  unlocked: boolean;
}

export interface DiscoveryEntry extends CodexEntry {
  kind: 'scenery' | 'species' | 'treasure' | 'geography' | 'culture' | 'place';
  x?: number;
  y?: number;
  /** 地標顯示在陸地；船隻從此海面座標觸發觀察。 */
  approachX?: number;
  approachY?: number;
  rewardGold?: number;
  rewardItemId?: string;
}

export interface ExplorationPoint {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  /** 地標顯示在陸地；船隻從此海面座標觸發登陸探索。 */
  approachX?: number;
  approachY?: number;
  difficulty: number;
  baseDays: number;
  cost: { food: number; water: number };
  discoveries: string[];
  events: string[];
  hint: string;
}

export interface StoryState {
  heroId: HeroId;
  chapter: number;
  completed: string[];
  codex: string[];
}

export interface GameState {
  version: number;
  gold: number;
  day: number; // 從 1 開始的絕對天數
  ship: PlayerShip; // 旗艦
  /** 僚艦（最多 4 艘，與旗艦共 5 艘） */
  escorts: PlayerShip[];
  cargo: Record<string, number>;
  /** 各貨物目前持有量的總購入成本（算平均成本用） */
  costBasis: Record<string, number>;
  food: number;
  water: number;
  crew: number;
  /** 疲勞 0~100，滿了水手減員 */
  fatigue: number;
  /** 本次出海已航行天數（入港歸零） */
  daysAtSea: number;
  events: MarketEvent[];
  /** 供需飽和：玩家頻繁在某港賣某貨會壓低賣價，隨時間回復。key=`portId|goodId` */
  demand: Record<string, { sat: number; day: number }>;
  /** 流行事件：全世界同時只有一個「都市×商品」流行（該都市原本不販售該貨），賣價×2 */
  fad: { portId: string; goodId: string; untilDay: number } | null;
  quest: Quest | null;
  /** 主角個人裝備 */
  equip: Equip;
  /** 已招募的夥伴 */
  mates: Mate[];
  /** 背包：已購買的個人裝備、船首像、消耗品數量 */
  inventory: Record<string, number>;
  /** 海上持續狀態（每日結算，入港不會自動消失） */
  statuses: SeaStatus[];
  /** 已造訪過的港口 id（用於首次進港的港口介紹） */
  visitedPorts: string[];
  /** 已靠近確認過的探索點 id（未確認前世界地圖只顯示問號） */
  discoveredExplorationPoints: string[];
  /** M4 主線劇情與圖鑑進度 */
  story: StoryState;
  /** 探索紀錄：完成探索次數與本輪商館任務候選 */
  exploration: ExplorationState;
  /** 造船廠建造中的船 */
  shipOrders: ShipOrder[];
  /** 船長等級、經驗與六圍能力值 */
  captain: CaptainState;
  /** 三軌聲望（v18）：只增不減 */
  reputation: ReputationState;
  /** 部族／勢力友好度（v18），key＝勢力 id（首版只有 sinckan 新港社） */
  friendship: Record<string, number>;
  /** 交易累積統計（v18，聲望與任務目標用）：總成交額與分港成交額 */
  tradeStats: { total: number; byPort: Record<string, number> };
  /** 海戰勝利次數（v18） */
  battleWins: number;
  /** 夥伴專屬任務進度（v18），key＝夥伴 id */
  mateQuests: Record<string, MateQuestProgress>;
}

export interface ExplorationState {
  attempts: Record<string, number>;
  questOfferDay: number;
  questOfferPortId: string | null;
  questOffers: Quest[];
}

export const FLEET_MAX = 5; // 含旗艦

export const GOODS: Good[] = goodsData.goods;
export const PORTS: Port[] = portsData.ports;
export const LANDS: Land[] = mapData.lands;
export const LABELS: MapLabel[] = mapData.labels;
export const WORLD_W = mapData.worldWidth;
export const WORLD_H = mapData.worldHeight;

export const SHIPS: ShipType[] = shipsData.ships;
export const WEAPONS: WeaponItem[] = equipData.weapons;
export const ARMORS: ArmorItem[] = equipData.armors;
export const ACCESSORIES: AccessoryItem[] = equipData.accessories;
export const FIGUREHEADS: FigureheadItem[] = equipData.figureheads;
export const HULL_PLATINGS: HullPlatingItem[] = equipData.hullPlatings;
export const SAILS: SailItem[] = equipData.sails;
export const CANNON_TYPES: CannonTypeItem[] = equipData.cannonTypes;
export const CONSUMABLES: ConsumableItem[] = equipData.consumables;
export const ROLES: RoleDef[] = matesData.roles;
export const MATE_DEFS: MateDef[] = matesData.mates as MateDef[];
export const HEROES: HeroDef[] = storyData.heroes as HeroDef[];
export const STORY_CHAPTERS: StoryChapter[] = storyData.chapters as StoryChapter[];
export const DISCOVERIES: DiscoveryEntry[] = discoveriesData.discoveries as DiscoveryEntry[];
export const EXPLORATION_POINTS: ExplorationPoint[] = explorationData.points as ExplorationPoint[];
export const CODEX_CATEGORIES: CodexCategory[] = codexData.categories as CodexCategory[];
// 圖鑑主資料在 data/codex.json；主線、探索、夥伴只負責解鎖 id。
export const CODEX_ENTRIES: CodexEntry[] = codexData.entries as CodexEntry[];
export const CREW_START = 16;
export const START_YEAR = 1622;
export const CANNON_PRICE = 3000;

export const SEA_STATUS_DEFS: Record<SeaStatusId, { name: string; desc: string }> = {
  storm: { name: '暴風雨', desc: '每天造成船體損傷，航速下降。可用祈禱藥水解除。' },
  rats: { name: '鼠患', desc: '老鼠偷吃糧食，食物消耗增加。可用船貓解除。' },
  scurvy: { name: '壞血病', desc: '船員疲勞快速上升，拖太久會有人倒下。可用萊姆解除。' },
  mutiny: { name: '船上叛亂', desc: '船員不聽指揮，航速下降且疲勞增加。可用安撫酒解除。' },
  homesick: { name: '思鄉病', desc: '長期離岸讓船員低落，疲勞增加。可用生薑藥湯緩解。' },
};

/** 存檔槽位總數：玩家可自由選擇 10 個位置存讀檔（方便分別測試三位主角的劇情） */
export const SAVE_SLOT_COUNT = 10;
const LEGACY_SAVE_KEY = 'seagame_save1'; // 舊版單一存檔，會自動搬到第 1 格
const ACTIVE_SLOT_KEY = 'seagame_active_slot'; // 目前正在玩的格子（自動存檔會寫到這格）
function slotKey(slot: number): string {
  return `seagame_save_slot${slot}`;
}
const START_POS = { x: 3260, y: 2076 }; // V3 月港外海 fallback

type MapReanchorV3 = {
  saveVersion: number;
  ports: Array<{ id: string; oldX: number; oldY: number; newX: number; newY: number }>;
};

const MAP_REANCHOR_V3 = mapReanchorV3Data as MapReanchorV3;

function dayForYear(year: number): number {
  return (year - START_YEAR) * 360 + 1;
}

function portStartPos(portId: string): { x: number; y: number } {
  const port = PORTS.find((p) => p.id === portId);
  if (!port) return START_POS;
  return { x: port.x, y: port.y };
}

export function newPlayerShip(typeId: string, pos: { x: number; y: number }): PlayerShip {
  const type = shipTypeById(typeId);
  const supply = Math.floor(type.space / 2);
  return {
    typeId: type.id,
    ...pos,
    hull: type.hullMax,
    cannons: Math.min(1, type.cannonSlots),
    cargoSpace: type.space - supply,
    supplySpace: supply,
    figurehead: null,
    armor: null,
    sail: null,
    cannonType: null,
  };
}

export function shipTypeById(id: string): ShipType {
  return SHIPS.find((t) => t.id === id) ?? SHIPS[0];
}

/** 建造天數：小船 3 天，大型船最多 30 天。 */
export function shipBuildDays(type: ShipType): number {
  const minPrice = Math.min(...SHIPS.map((s) => s.price));
  const maxPrice = Math.max(...SHIPS.map((s) => s.price));
  if (maxPrice <= minPrice) return 3;
  const ratio = (type.price - minPrice) / (maxPrice - minPrice);
  return Math.max(3, Math.min(30, Math.round(3 + ratio * 27)));
}

/** 旗艦船型 */
export function shipTypeOf(state: GameState): ShipType {
  return shipTypeById(state.ship.typeId);
}

/** 全艦隊（旗艦＋僚艦） */
export function fleetShips(state: GameState): PlayerShip[] {
  return [state.ship, ...state.escorts];
}

/** 貨艙上限＝全艦隊商品艙加總 */
export function cargoMax(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + sh.cargoSpace, 0);
}

/** 糧／水上限＝全艦隊糧水艙加總 */
export function supplyMax(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + sh.supplySpace, 0);
}

/** 旗艦船體上限（旅館保養、旗艦修理用） */
export function hullMax(state: GameState): number {
  return shipTypeOf(state).hullMax + (shipArmor(state)?.hullBonus ?? 0);
}

/** 水手上限＝全艦隊各船型 maxCrew 加總 */
export function crewMax(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + shipTypeById(sh.typeId).maxCrew, 0);
}

/** 全艦隊最低水手需求（各船 minCrew 加總） */
export function fleetMinCrew(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + shipTypeById(sh.typeId).minCrew, 0);
}

/** 全艦隊總砲數（海戰火力） */
export function fleetCannons(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + sh.cannons, 0);
}

/** 全艦隊現有船體總和 */
export function fleetHull(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + sh.hull, 0);
}

/** 全艦隊船體上限總和（旗艦含裝甲加成） */
export function fleetHullMax(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + shipTypeById(sh.typeId).hullMax, 0) + (shipArmor(state)?.hullBonus ?? 0);
}

/** 對全艦隊造成傷害（按各船血量比例分攤，每船至少留 1） */
export function damageFleet(state: GameState, dmg: number): void {
  const ships = fleetShips(state);
  const total = fleetHull(state);
  if (total <= 0) return;
  for (const sh of ships) {
    const share = Math.round(dmg * (sh.hull / total));
    sh.hull = Math.max(1, sh.hull - share);
  }
}

export function heroDefById(id: string | undefined): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export function newGame(heroId: HeroId = 'lin'): GameState {
  const hero = heroDefById(heroId);
  const pos = portStartPos(hero.startPortId);
  const ship = newPlayerShip(hero.startShipTypeId, pos);
  return {
    version: 18,
    gold: hero.startGold,
    day: dayForYear(hero.startYear),
    ship,
    escorts: [],
    cargo: {},
    costBasis: {},
    food: Math.floor(ship.supplySpace / 2),
    water: Math.floor(ship.supplySpace / 2),
    crew: hero.startCrew,
    fatigue: 0,
    daysAtSea: 0,
    events: [],
    demand: {},
    fad: null,
    quest: null,
    equip: { weapon: null, armor: null, accessory: null },
    mates: [],
    inventory: {},
    statuses: [],
    visitedPorts: [],
    discoveredExplorationPoints: [],
    story: {
      heroId: hero.id,
      chapter: 1,
      completed: [],
      codex: [],
    },
    exploration: {
      attempts: {},
      questOfferDay: 0,
      questOfferPortId: null,
      questOffers: [],
    },
    shipOrders: [],
    captain: { level: 1, xp: 0, stats: heroBaseStats(hero.id) },
    reputation: { adventure: 0, trade: 0, valor: 0 },
    friendship: {},
    tradeStats: { total: 0, byPort: {} },
    battleWins: 0,
    mateQuests: {},
  };
}

/** 每日糧食消耗量（水手越多吃越多） */
export function foodPerDay(crew: number): number {
  return Math.max(1, Math.ceil(crew / 5));
}

/** 每日清水消耗量 */
export function waterPerDay(crew: number): number {
  return Math.max(1, Math.ceil(crew / 5));
}

/** 以目前糧水與水手數估算還能航行幾天 */
export function sailableDays(state: GameState): number {
  return Math.min(
    Math.floor(state.food / foodPerDay(state.crew)),
    Math.floor(state.water / waterPerDay(state.crew))
  );
}

/**
 * 水手不足時的航速倍率（老闆設計）：
 * 達最低水手數＝正常；低於最低＝減半；低於最低的一半＝最慢
 */
export function crewSpeedMod(state: GameState): number {
  const min = fleetMinCrew(state);
  if (state.crew >= min) return 1;
  if (state.crew >= Math.ceil(min / 2)) return 0.5;
  return 0.3;
}

/** 平均購入成本（無持有回傳 0） */
export function avgCost(state: GameState, goodId: string): number {
  const own = state.cargo[goodId] ?? 0;
  if (own <= 0) return 0;
  return Math.round((state.costBasis[goodId] ?? 0) / own);
}

// ---------- 裝備效果 ----------

export function weaponBoard(state: GameState): number {
  const w = WEAPONS.find((x) => x.id === state.equip.weapon);
  return w ? w.board : 0;
}

export function armorDefense(state: GameState): number {
  const a = ARMORS.find((x) => x.id === state.equip.armor);
  return a ? a.defense : 0;
}

function accessoryEffect(state: GameState): string | null {
  const a = ACCESSORIES.find((x) => x.id === state.equip.accessory);
  return a ? a.effect : null;
}

/** 旗艦船隻裝備（裝甲／船帆／大砲種類），無則 null */
export function shipArmor(state: GameState): HullPlatingItem | null {
  return HULL_PLATINGS.find((x) => x.id === state.ship.armor) ?? null;
}
export function shipSail(state: GameState): SailItem | null {
  return SAILS.find((x) => x.id === state.ship.sail) ?? null;
}
export function shipCannonType(state: GameState): CannonTypeItem | null {
  return CANNON_TYPES.find((x) => x.id === state.ship.cannonType) ?? null;
}

/** 旗艦船首像效果 */
export function figureheadEffect(state: GameState): string | null {
  const f = FIGUREHEADS.find((x) => x.id === state.ship.figurehead);
  return f ? f.effect : null;
}

/** 航速加成倍率（羅盤＋海龍像＋航海長） */
export function gearSpeedMod(state: GameState): number {
  let b = 1;
  if (accessoryEffect(state) === 'speed') b += 0.05;
  if (figureheadEffect(state) === 'speed') b += 0.1;
  if (hasRole(state, 'navigator')) b += 0.08;
  b += fleetStat(state, 'nav') / 600; // 航海能力加成
  b += shipSail(state)?.speedBonus ?? 0; // 船帆加成
  return b;
}

/** 暴風損害倍率（媽祖像減半＋航海長再減） */
export function stormDamageMod(state: GameState): number {
  let m = figureheadEffect(state) === 'storm' ? 0.5 : 1;
  if (hasRole(state, 'navigator')) m *= 0.8;
  m *= 1 - Math.min(0.4, fleetStat(state, 'nav') / 400); // 航海越高，暴風損害越低
  m *= 1 - Math.min(0.4, (shipArmor(state)?.stormReduce ?? 0) + (shipSail(state)?.stormReduce ?? 0)); // 裝甲＋船帆抗暴風
  return m;
}

/** 海上突襲機率倍率（望遠鏡降低） */
export function ambushMod(state: GameState): number {
  return accessoryEffect(state) === 'scout' ? 0.6 : 1;
}

/** 每日疲勞累積倍率（媽祖護身符＋鳳凰像＋水手長） */
export function fatigueMod(state: GameState): number {
  let m = 1;
  if (accessoryEffect(state) === 'morale') m -= 0.2;
  if (figureheadEffect(state) === 'morale') m -= 0.2;
  if (hasRole(state, 'boatswain')) m -= 0.2;
  m -= Math.min(0.3, fleetStat(state, 'lead') / 500); // 統率越高，疲勞累積越慢
  return Math.max(0.4, m);
}

/** 持續狀態造成的航速倍率 */
export function statusSpeedMod(state: GameState): number {
  let m = 1;
  if (hasSeaStatus(state, 'storm')) m *= 0.75;
  if (hasSeaStatus(state, 'mutiny')) m *= 0.75;
  return m;
}

/** 海戰砲擊倍率（獅子像＋砲術長） */
export function cannonMod(state: GameState): number {
  let m = figureheadEffect(state) === 'cannon' ? 1.25 : 1;
  if (hasRole(state, 'gunner')) m *= 1.2;
  m *= 1 + fleetStat(state, 'gun') / 300; // 砲術能力加成
  m *= shipCannonType(state)?.power ?? 1; // 大砲種類倍率
  return m;
}

/** 交易折扣比例（算盤飾品＋主計長夥伴）：買價×(1−d)、賣價×(1+d） */
export function tradeBonus(state: GameState): number {
  let d = accessoryEffect(state) === 'trade' ? 0.05 : 0;
  if (hasRole(state, 'purser')) d += 0.05;
  d += Math.min(0.1, fleetStat(state, 'neg') / 800); // 交涉能力加成
  return d;
}

// ---------- 夥伴職位 ----------

export function mateDefById(id: string): MateDef | undefined {
  return MATE_DEFS.find((m) => m.id === id);
}

export function mateCodexId(id: string): string {
  return `mate_${id}`;
}

// ---------- 能力值與等級系統 ----------

const ROLE_STAT: Record<string, StatKey> = {
  vice: 'lead', boatswain: 'lead', gunner: 'gun', navigator: 'nav',
  purser: 'neg', interpreter: 'neg', strategist: 'kno', surgeon: 'kno', guide: 'kno', scholar: 'kno',
};
const STAR_SPEC: Record<number, number> = { 1: 34, 2: 46, 3: 58, 4: 72, 5: 86 };
const STAR_FLOOR: Record<number, number> = { 1: 18, 2: 22, 3: 26, 4: 32, 5: 40 };
const DEFAULT_STATS: Stats = { lead: 16, gun: 14, val: 14, nav: 18, kno: 16, neg: 18 };

/** 夥伴六圍：依星級＋職位規則產生；mates.json 的 `stats` 可逐項覆蓋微調。 */
export function mateStats(def: MateDef): Stats {
  const floor = STAR_FLOOR[def.star] ?? 24;
  const spec = STAR_SPEC[def.star] ?? 50;
  const s: Stats = { lead: floor, gun: floor, val: floor, nav: floor, kno: floor, neg: floor };
  if (def.roles.includes('gunner') || def.roles.includes('vice')) s.val = floor + 12;
  const primary = ROLE_STAT[def.roles[0]];
  if (primary) s[primary] = spec;
  if (def.roles[1]) {
    const sec = ROLE_STAT[def.roles[1]];
    if (sec) s[sec] = Math.max(s[sec], spec - 8);
  }
  for (const k of STAT_KEYS) s[k] = Math.min(99, s[k]);
  if (def.stats) for (const k of STAT_KEYS) if (typeof def.stats[k] === 'number') s[k] = def.stats[k]!;
  return s;
}

export function heroBaseStats(heroId: string): Stats {
  return { ...DEFAULT_STATS, ...(heroDefById(heroId).baseStats ?? {}) };
}
function heroAptitude(heroId: string): Stats {
  return { ...DEFAULT_STATS, ...(heroDefById(heroId).aptitude ?? {}) };
}

/** 艦隊在某能力維度的總能力＝船長能力＋擔任對應職位的在隊夥伴能力。 */
export function fleetStat(state: GameState, key: StatKey): number {
  let v = state.captain?.stats?.[key] ?? 0;
  for (const m of state.mates) {
    if (m.role && ROLE_STAT[m.role] === key) {
      const def = mateDefById(m.id);
      if (def) v += mateStats(def)[key];
    }
  }
  return v;
}

export function xpForNextLevel(level: number): number {
  return 100 + (level - 1) * 60;
}

const LEVEL_POINTS = 5; // 每級成長點數
/** 最大餘數法：把 budget 點依成長傾向分配到各能力（高傾向拿較多，弱項仍按比例成長）。 */
function allocatePoints(budget: number, aptitude: Stats): Record<StatKey, number> {
  const totalW = STAT_KEYS.reduce((a, k) => a + (aptitude[k] || 0), 0) || 1;
  const res: Record<StatKey, number> = { lead: 0, gun: 0, val: 0, nav: 0, kno: 0, neg: 0 };
  const frac: Array<{ k: StatKey; f: number }> = [];
  let used = 0;
  for (const k of STAT_KEYS) {
    const v = (budget * (aptitude[k] || 0)) / totalW;
    const fl = Math.floor(v);
    res[k] = fl; used += fl; frac.push({ k, f: v - fl });
  }
  frac.sort((a, b) => b.f - a.f);
  for (let j = 0; j < budget - used && j < frac.length; j++) res[frac[j].k] += 1;
  return res;
}

/** 某主角在某等級的六圍＝起始值＋累積成長（等級的純函式，弱項也會緩慢成長）。 */
export function statsAtLevel(heroId: string, level: number): Stats {
  const base = heroBaseStats(heroId);
  const alloc = allocatePoints(Math.max(0, level - 1) * LEVEL_POINTS, heroAptitude(heroId));
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = Math.min(99, base[k] + alloc[k]);
  return stats;
}

export interface XpResult { gained: number; levelsGained: number; newLevel: number; statGains: Partial<Stats>; }

/** 給船長加經驗，處理升級與自動加點；回傳升級資訊供 UI 提示。 */
export function addXp(state: GameState, amount: number): XpResult {
  const cap = state.captain;
  const res: XpResult = { gained: amount, levelsGained: 0, newLevel: cap.level, statGains: {} };
  if (amount <= 0 || cap.level >= LEVEL_CAP) return res;
  cap.xp += amount;
  const before = { ...cap.stats };
  while (cap.level < LEVEL_CAP && cap.xp >= xpForNextLevel(cap.level)) {
    cap.xp -= xpForNextLevel(cap.level);
    cap.level += 1;
    res.levelsGained += 1;
  }
  if (cap.level >= LEVEL_CAP) cap.xp = 0;
  if (res.levelsGained > 0) {
    cap.stats = statsAtLevel(state.story.heroId, cap.level);
    for (const k of STAT_KEYS) { const d = cap.stats[k] - before[k]; if (d > 0) res.statGains[k] = d; }
  }
  res.newLevel = cap.level;
  return res;
}

export function xpProgressText(state: GameState): string {
  const c = state.captain;
  if (c.level >= LEVEL_CAP) return `Lv${LEVEL_CAP}（已滿級）`;
  return `Lv${c.level}　經驗 ${c.xp}/${xpForNextLevel(c.level)}`;
}

/** 升級提示文字（無升級回空字串）。 */
export function levelUpMessage(r: XpResult): string {
  if (r.levelsGained <= 0) return '';
  const parts = STAT_KEYS.filter((k) => r.statGains[k]).map((k) => `${STAT_NAMES[k]}+${r.statGains[k]}`);
  return `⭐ 升級！等級提升到 Lv${r.newLevel}${parts.length ? `（${parts.join('、')}）` : ''}`;
}

export function roleName(key: string | null): string {
  if (!key) return '（未指派）';
  return ROLES.find((r) => r.key === key)?.name ?? key;
}

// ---------- 聲望系統（v18，設計依缺失清單第八節） ----------

/** 增加聲望（只增不減）；回傳提示文字（amount<=0 回空字串）。 */
export function addReputation(state: GameState, kind: RepKind, amount: number): string {
  if (amount <= 0) return '';
  if (!state.reputation) state.reputation = { adventure: 0, trade: 0, valor: 0 };
  state.reputation[kind] += amount;
  return `⚑ ${REP_NAMES[kind]} +${amount}`;
}

/** 增加部族／勢力友好度；回傳提示文字。 */
export function addFriendship(state: GameState, factionId: string, amount: number): string {
  if (amount <= 0) return '';
  if (!state.friendship) state.friendship = {};
  state.friendship[factionId] = (state.friendship[factionId] ?? 0) + amount;
  return `💛 ${FACTION_NAMES[factionId] ?? factionId}友好度 +${amount}`;
}

/** 聲望白話級距描述（給人物資訊頁，用字以國小生能懂為準）。 */
export function repLevelDesc(kind: RepKind, value: number): string {
  const tiers: Record<RepKind, [string, string, string, string]> = {
    adventure: ['還沒什麼探險事蹟', '港口開始流傳你的探險故事', '大家都知道你是勇敢的探險家', '傳說級的大航海探險家'],
    trade: ['商人們還不認識你', '各港的商人都認得你了', '你是有信用的大商人', '名震四海的豪商'],
    valor: ['海上還沒人聽過你', '海上開始流傳你的戰績', '海盜看到你的旗子會緊張', '威震七海的船長'],
  };
  const t = tiers[kind];
  if (value >= 80) return t[3];
  if (value >= 40) return t[2];
  if (value >= 15) return t[1];
  return t[0];
}

/** 夥伴條件清單項：text 為條件描述（含目前進度），met 為是否已達成。 */
export interface MateConditionItem { text: string; met: boolean; }

/** 把一組招募條件展開成「全部條件＋達成狀態」清單（含已達成項，供條件視窗打勾顯示）。 */
export function mateConditionChecklist(state: GameState, req: MateRequirement | undefined): MateConditionItem[] {
  const items: MateConditionItem[] = [];
  if (!req) return items;

  if (req.heroIds?.length) {
    const names = req.heroIds.map((id) => heroDefById(id).name).join('／');
    items.push({ text: `主角線限定：${names}`, met: req.heroIds.includes(state.story.heroId) });
  }
  if (req.minChapter) {
    items.push({
      text: `把主線推進到第 ${req.minChapter} 章（目前第 ${state.story.chapter} 章）`,
      met: state.story.chapter >= req.minChapter,
    });
  }
  if (req.maxChapter) {
    items.push({
      text: `在第 ${req.maxChapter} 章以前結識（目前第 ${state.story.chapter} 章）`,
      met: state.story.chapter <= req.maxChapter,
    });
  }
  if (req.gold) {
    items.push({ text: `身上備妥 ${req.gold} 兩（目前 ${state.gold} 兩）`, met: state.gold >= req.gold });
  }
  for (const cargo of req.cargo ?? []) {
    const have = state.cargo[cargo.goodId] ?? 0;
    const good = GOODS.find((g) => g.id === cargo.goodId);
    items.push({ text: `攜帶【${good?.name ?? cargo.goodId}×${cargo.qty}】（目前 ${have}）`, met: have >= cargo.qty });
  }
  for (const pointId of req.discoveredExplorationPoints ?? []) {
    const point = EXPLORATION_POINTS.find((p) => p.id === pointId);
    items.push({
      text: `前往確認探索點【${point?.name ?? pointId}】`,
      met: state.discoveredExplorationPoints.includes(pointId),
    });
  }
  for (const codexId of req.codexIds ?? []) {
    const entry = CODEX_ENTRIES.find((x) => x.id === codexId);
    items.push({ text: `解鎖圖鑑【${entry?.title ?? codexId}】`, met: state.story.codex.includes(codexId) });
  }
  for (const [kind, min] of Object.entries(req.reputation ?? {}) as Array<[RepKind, number]>) {
    const cur = state.reputation?.[kind] ?? 0;
    items.push({ text: `${REP_NAMES[kind]}達到 ${min}（目前 ${cur}）`, met: cur >= min });
  }
  for (const [factionId, min] of Object.entries(req.friendship ?? {})) {
    const cur = state.friendship?.[factionId] ?? 0;
    items.push({ text: `${FACTION_NAMES[factionId] ?? factionId}友好度達到 ${min}（目前 ${cur}）`, met: cur >= min });
  }
  for (const [key, min] of Object.entries(req.stats ?? {}) as Array<[StatKey, number]>) {
    const cur = state.captain?.stats?.[key] ?? 0;
    items.push({ text: `船長${STAT_NAMES[key]}達到 ${min}（目前 ${cur}）`, met: cur >= min });
  }
  for (const portId of req.visitPorts ?? []) {
    const port = PORTS.find((p) => p.id === portId);
    items.push({ text: `造訪過【${port?.name ?? portId}】`, met: state.visitedPorts.includes(portId) });
  }
  if (req.tradeTotal) {
    const cur = state.tradeStats?.total ?? 0;
    items.push({ text: `累積賣出貨物 ${req.tradeTotal} 兩（目前 ${cur}）`, met: cur >= req.tradeTotal });
  }
  if (req.tradeAtPort) {
    const port = PORTS.find((p) => p.id === req.tradeAtPort!.portId);
    const cur = state.tradeStats?.byPort?.[req.tradeAtPort.portId] ?? 0;
    items.push({ text: `在【${port?.name ?? req.tradeAtPort.portId}】累積賣出 ${req.tradeAtPort.min} 兩（目前 ${cur}）`, met: cur >= req.tradeAtPort.min });
  }
  if (req.battleWins) {
    const cur = state.battleWins ?? 0;
    items.push({ text: `海戰勝利 ${req.battleWins} 次（目前 ${cur} 次）`, met: cur >= req.battleWins });
  }
  return items;
}

function mateRequirementLines(state: GameState, req: MateRequirement | undefined): string[] {
  return mateConditionChecklist(state, req).filter((it) => !it.met).map((it) => it.text);
}

/** 玩家在本輪主角線是否永遠無法招募此夥伴（主角線不符，或限時章節已過）；可招募回傳 null。 */
export function mateUnavailableReason(state: GameState, def: MateDef): string | null {
  const reqs: MateRequirement[] = [];
  if (def.requirement) reqs.push(def.requirement);
  for (const st of def.questStages ?? []) if (st.requirement) reqs.push(st.requirement);
  for (const r of reqs) {
    if (r.heroIds?.length && !r.heroIds.includes(state.story.heroId)) {
      const names = r.heroIds.map((id) => heroDefById(id).name).join('／');
      return `此主角線無法招募（限定：${names}）`;
    }
  }
  for (const r of reqs) {
    if (r.maxChapter && state.story.chapter > r.maxChapter) {
      return `時機已過（需在第 ${r.maxChapter} 章以前結識）`;
    }
  }
  return null;
}

/** 玩家下一個該做的招募條件（給卡片「下一步」提示用）；條件全達成回傳空字串。 */
export function mateNextStepText(state: GameState, def: MateDef): string {
  const stages = def.questStages ?? [];
  const prog = stages.length ? state.mateQuests?.[def.id] : undefined;
  // 有專屬任務且還沒接：接任務是玩家現在就能做的事，優先提示
  if (stages.length && !prog) {
    const portName = PORTS.find((p) => p.id === def.portId)?.name ?? def.portId;
    return `到【${portName}】接下專屬任務「${def.questTitle}」`;
  }
  const base = mateRequirementLines(state, def.requirement);
  if (base.length) return base[0];
  if (stages.length) {
    const portName = PORTS.find((p) => p.id === def.portId)?.name ?? def.portId;
    const statuses = mateQuestStageStatuses(state, def);
    for (let i = 0; i < statuses.length; i++) {
      const st = statuses[i];
      if (st.ok) continue;
      const stage = stages[i];
      if ((stage.reportAtPort || stage.consumeCargo) && mateRequirementLines(state, stage.requirement).length === 0) {
        return `回【${portName}】向${def.name}回報「${st.title}」`;
      }
      return st.lines[0] ?? st.title;
    }
  }
  return '';
}

// ---------- 夥伴專屬任務（v18 持久化進度） ----------

/** 取得夥伴任務進度（未接取回傳 null）。 */
export function mateQuestProgress(state: GameState, mateId: string): MateQuestProgress | null {
  return state.mateQuests?.[mateId] ?? null;
}

/** 接下夥伴專屬任務：建立持久進度，並立即鎖存目前已達成的階段。 */
export function acceptMateQuest(state: GameState, mateId: string): { ok: boolean; msg: string } {
  const def = mateDefById(mateId);
  if (!def || !(def.questStages ?? []).length) return { ok: false, msg: '這位夥伴沒有專屬任務。' };
  if (state.mates.some((m) => m.id === mateId)) return { ok: false, msg: '已經是夥伴了。' };
  if (!state.mateQuests) state.mateQuests = {};
  if (state.mateQuests[mateId]) return { ok: false, msg: '任務已經在進行中了。' };
  if (mateUnavailableReason(state, def)) return { ok: false, msg: '這條主角線無法進行這個任務。' };
  state.mateQuests[mateId] = {
    status: 'active',
    stagesDone: (def.questStages ?? []).map(() => false),
    acceptedDay: state.day,
  };
  const latched = updateMateQuestProgress(state);
  return { ok: true, msg: [`📜 接下了${def.name}的專屬任務「${def.questTitle}」！`, ...latched].join('\n') };
}

/**
 * 巡檢所有進行中的夥伴任務，把「條件已達成」的階段依序鎖存為永久完成
 * （之後資金、貨物變動都不會倒退）。需玩家回報的階段（對話／交付）不自動完成。
 * 回傳本次新完成階段的提示文字。
 */
export function updateMateQuestProgress(state: GameState): string[] {
  const msgs: string[] = [];
  for (const [mateId, prog] of Object.entries(state.mateQuests ?? {})) {
    if (prog.status !== 'active') continue;
    const def = mateDefById(mateId);
    const stages = def?.questStages ?? [];
    if (!def || !stages.length) continue;
    while (prog.stagesDone.length < stages.length) prog.stagesDone.push(false);
    for (let i = 0; i < stages.length; i++) {
      if (prog.stagesDone[i]) continue;
      const stage = stages[i];
      if (stage.reportAtPort || stage.consumeCargo) break; // 需到夥伴所在港回報，不自動完成
      if (stage.duel) break; // 需海上決鬥獲勝，不自動完成
      if (mateRequirementLines(state, stage.requirement).length > 0) break; // 任務鏈依序進行
      prog.stagesDone[i] = true;
      msgs.push(`📜 ${def.name}的任務進度：完成「${stage.title}」（${i + 1}/${stages.length}）`);
    }
  }
  return msgs;
}

/** 目前輪到的海上決鬥（任一進行中任務的當前階段為 duel）；沒有回傳 null。 */
export interface PendingMateDuel { mateId: string; mateName: string; stageIndex: number; name: string; tier: number; }
export function pendingMateDuel(state: GameState): PendingMateDuel | null {
  for (const [mateId, prog] of Object.entries(state.mateQuests ?? {})) {
    if (prog.status !== 'active') continue;
    const def = mateDefById(mateId);
    const stages = def?.questStages ?? [];
    if (!def) continue;
    for (let i = 0; i < stages.length; i++) {
      if (prog.stagesDone[i]) continue;
      const stage = stages[i];
      if (stage.duel) return { mateId, mateName: def.name, stageIndex: i, name: stage.duel.name, tier: stage.duel.tier };
      break; // 輪到的不是決鬥階段
    }
  }
  return null;
}

/** 海上決鬥獲勝：鎖存該決鬥階段並巡檢後續；回傳提示文字。 */
export function completeMateDuel(state: GameState, mateId: string): string[] {
  const def = mateDefById(mateId);
  const prog = state.mateQuests?.[mateId];
  const stages = def?.questStages ?? [];
  if (!def || !prog) return [];
  for (let i = 0; i < stages.length; i++) {
    if (prog.stagesDone[i]) continue;
    const stage = stages[i];
    if (!stage.duel) break;
    prog.stagesDone[i] = true;
    return [
      `⚔ 擊敗了${stage.duel.name}！完成「${stage.title}」（${i + 1}/${stages.length}）`,
      ...updateMateQuestProgress(state),
    ];
  }
  return [];
}

/** 目前可回報的階段 index（進行中、輪到的階段是回報類、條件已達成）；沒有回傳 -1。 */
export function reportableMateQuestStageIndex(state: GameState, def: MateDef): number {
  const prog = state.mateQuests?.[def.id];
  const stages = def.questStages ?? [];
  if (!prog || prog.status !== 'active') return -1;
  for (let i = 0; i < stages.length; i++) {
    if (prog.stagesDone[i]) continue;
    const stage = stages[i];
    if (!stage.reportAtPort && !stage.consumeCargo) return -1; // 輪到的是自動階段，交給巡檢
    return mateRequirementLines(state, stage.requirement).length === 0 ? i : -1;
  }
  return -1;
}

/** 在夥伴所在港回報任務階段：交付貨物（如有）、鎖存該階段，並巡檢後續階段。 */
export function reportMateQuestStage(state: GameState, mateId: string): { ok: boolean; msg: string } {
  const def = mateDefById(mateId);
  if (!def) return { ok: false, msg: '' };
  const idx = reportableMateQuestStageIndex(state, def);
  if (idx < 0) return { ok: false, msg: '目前沒有可以回報的進度。' };
  const stage = (def.questStages ?? [])[idx];
  const prog = state.mateQuests![mateId];
  const delivered: string[] = [];
  if (stage.consumeCargo) {
    for (const c of stage.requirement?.cargo ?? []) {
      const own = state.cargo[c.goodId] ?? 0;
      if (own < c.qty) return { ok: false, msg: '貨物不足，還不能交付。' };
      const basis = state.costBasis[c.goodId] ?? 0;
      state.costBasis[c.goodId] = Math.round(basis * ((own - c.qty) / own));
      state.cargo[c.goodId] = own - c.qty;
      if (state.cargo[c.goodId] === 0) {
        delete state.cargo[c.goodId];
        delete state.costBasis[c.goodId];
      }
      const good = GOODS.find((g) => g.id === c.goodId);
      delivered.push(`${good?.name ?? c.goodId}×${c.qty}`);
    }
  }
  prog.stagesDone[idx] = true;
  const stages = def.questStages ?? [];
  const msgs = [
    `📜 向${def.name}回報：完成「${stage.title}」（${idx + 1}/${stages.length}）`,
    delivered.length ? `交付了 ${delivered.join('、')}。` : '',
    ...updateMateQuestProgress(state),
  ];
  return { ok: true, msg: msgs.filter(Boolean).join('\n') };
}

/**
 * 各任務階段狀態：ok 讀「持久化鎖存進度」（接下任務後才會累積；完成後永久保持，
 * 不因資金貨物變動倒退）；lines 為該階段目前尚缺的條件（供 UI 顯示）。
 */
export function mateQuestStageStatuses(state: GameState, def: MateDef): Array<{ title: string; desc: string; ok: boolean; lines: string[] }> {
  const prog = state.mateQuests?.[def.id];
  return (def.questStages ?? []).map((stage, i) => {
    const done = !!prog?.stagesDone?.[i];
    return {
      title: stage.title,
      desc: stage.desc,
      ok: done,
      lines: done ? [] : stage.duel ? [`出海航行，擊敗【${stage.duel.name}】`] : mateRequirementLines(state, stage.requirement),
    };
  });
}

export function mateRequirementStatus(state: GameState, def: MateDef): { ok: boolean; lines: string[] } {
  const req = def.requirement;
  const stages = def.questStages ?? [];
  const lines = mateRequirementLines(state, req);
  if (stages.length) {
    const prog = state.mateQuests?.[def.id];
    if (!prog) {
      lines.push(`先接下專屬任務「${def.questTitle}」。`);
    } else {
      for (const stage of mateQuestStageStatuses(state, def)) {
        if (!stage.ok) lines.push(`專屬任務未完成：${stage.title}。`);
      }
    }
  }
  if (!req && stages.length === 0) return { ok: true, lines: ['條件：付出謝禮即可邀請。'] };
  return { ok: lines.length === 0, lines: lines.length ? lines : ['條件已達成。'] };
}

/** 招募夥伴（共用入隊邏輯）：扣謝禮、入隊、指派預設職位（同職位互斥）、解鎖人物圖鑑。
 *  呼叫前請先用 mateRequirementStatus 確認條件、確認資金足夠。 */
export function recruitMate(
  state: GameState,
  mateId: string
): { ok: boolean; unlocked: string[]; roleKey: string | null; levelMsg: string } {
  const def = mateDefById(mateId);
  if (!def) return { ok: false, unlocked: [], roleKey: null, levelMsg: '' };
  if (state.mates.some((m) => m.id === mateId)) return { ok: false, unlocked: [], roleKey: null, levelMsg: '' };
  if (state.gold < def.fee) return { ok: false, unlocked: [], roleKey: null, levelMsg: '' };
  state.gold -= def.fee;
  const roleKey = def.roles[0] ?? null;
  if (roleKey) {
    for (const m of state.mates) if (m.role === roleKey) m.role = null; // 同職位互斥
  }
  state.mates.push({ id: mateId, role: roleKey });
  if (state.mateQuests?.[mateId]) state.mateQuests[mateId].status = 'done';
  const unlocked = unlockCodex(state, [mateCodexId(mateId)]);
  const levelMsg = levelUpMessage(addXp(state, 40));
  return { ok: true, unlocked, roleKey, levelMsg };
}

/** 是否有夥伴擔任某職位 */
export function hasRole(state: GameState, roleKey: string): boolean {
  return state.mates.some((m) => m.role === roleKey);
}

/** 接舷額外戰力（副隊長＋統率／武勇能力） */
export function boardBonus(state: GameState): number {
  let b = hasRole(state, 'vice') ? 8 : 0;
  b += Math.round(fleetStat(state, 'lead') / 15 + fleetStat(state, 'val') / 12);
  b += shipCannonType(state)?.board ?? 0; // 散彈砲接舷壓制
  return b;
}

/** 接舷減員是否獲得緩衝（醫師夥伴、重甲或高統率） */
export function reduceCrewLoss(state: GameState): boolean {
  return hasRole(state, 'surgeon') || armorDefense(state) >= 8 || fleetStat(state, 'lead') >= 80;
}

// ---------- 背包／道具 ----------

export function itemNameById(id: string): string {
  return (
    WEAPONS.find((x) => x.id === id)?.name ??
    ARMORS.find((x) => x.id === id)?.name ??
    ACCESSORIES.find((x) => x.id === id)?.name ??
    FIGUREHEADS.find((x) => x.id === id)?.name ??
    HULL_PLATINGS.find((x) => x.id === id)?.name ??
    SAILS.find((x) => x.id === id)?.name ??
    CANNON_TYPES.find((x) => x.id === id)?.name ??
    CONSUMABLES.find((x) => x.id === id)?.name ??
    DISCOVERIES.find((x) => x.id === id || x.rewardItemId === id)?.title ??
    id
  );
}

export function itemDescById(id: string): string {
  return (
    WEAPONS.find((x) => x.id === id)?.desc ??
    ARMORS.find((x) => x.id === id)?.desc ??
    ACCESSORIES.find((x) => x.id === id)?.desc ??
    FIGUREHEADS.find((x) => x.id === id)?.desc ??
    HULL_PLATINGS.find((x) => x.id === id)?.desc ??
    SAILS.find((x) => x.id === id)?.desc ??
    CANNON_TYPES.find((x) => x.id === id)?.desc ??
    CONSUMABLES.find((x) => x.id === id)?.desc ??
    DISCOVERIES.find((x) => x.id === id || x.rewardItemId === id)?.body ??
    ''
  );
}

export function isTreasureItem(id: string): boolean {
  return DISCOVERIES.some((x) => x.kind === 'treasure' && (x.id === id || x.rewardItemId === id));
}

export function itemSellValueById(id: string): number {
  const equipPrice =
    WEAPONS.find((x) => x.id === id)?.price ??
    ARMORS.find((x) => x.id === id)?.price ??
    ACCESSORIES.find((x) => x.id === id)?.price ??
    FIGUREHEADS.find((x) => x.id === id)?.price;
  if (equipPrice) return Math.max(100, Math.round(equipPrice * 0.45));
  const discovery = DISCOVERIES.find((x) => x.id === id || x.rewardItemId === id);
  if (discovery?.rewardGold) return Math.max(80, discovery.rewardGold);
  return 100;
}

export function addInventory(state: GameState, id: string, qty = 1): void {
  state.inventory[id] = (state.inventory[id] ?? 0) + qty;
}

export function hasInventory(state: GameState, id: string): boolean {
  return (state.inventory[id] ?? 0) > 0;
}

function consumeInventory(state: GameState, id: string): void {
  state.inventory[id] = Math.max(0, (state.inventory[id] ?? 0) - 1);
  if (state.inventory[id] <= 0) delete state.inventory[id];
}

export function sellInventoryItem(state: GameState, id: string): string {
  if (!hasInventory(state, id)) return `背包裡沒有【${itemNameById(id)}】。`;
  const value = itemSellValueById(id);
  consumeInventory(state, id);
  state.gold += value;
  return `賣出【${itemNameById(id)}】，獲得 ${value} 兩。`;
}

export function shopItemIdsForPort(port: Port): Record<ShopCat, string[]> {
  const isTaiwan = port.region === '台灣' || port.region === '澎湖';
  const isSpiceIslands = ['ambon', 'banda', 'ternate'].includes(port.id);
  const stock: Record<ShopCat, Set<string>> = {
    weapon: new Set(['w_knife']),
    armor: new Set(['a_cloth']),
    accessory: new Set(),
    consumable: new Set(['c_lime']),
  };
  const add = (cat: ShopCat, ids: string[]) => ids.forEach((id) => stock[cat].add(id));

  if (port.culture === 'han') {
    add('weapon', ['w_saber']);
    add('armor', ['a_brigandine']);
    add('accessory', ['ac_compass', 'ac_abacus', 'ac_charm']);
    add('consumable', ['c_cat', 'c_ginger']);
  } else if (port.culture === 'wa') {
    add('weapon', ['w_katana']);
    add('armor', ['a_nanban']);
    add('accessory', ['ac_telescope']);
    add('consumable', ['c_cat', 'c_mediator']);
  } else if (port.culture === 'euro') {
    add('weapon', ['w_rapier', 'w_musket']);
    add('armor', ['a_leather']);
    add('accessory', ['ac_compass', 'ac_telescope']);
    add('consumable', ['c_prayer']);
  } else {
    add('armor', ['a_leather']);
    if (!isSpiceIslands) add('accessory', ['ac_compass']);
    add('consumable', ['c_ginger', 'c_mediator']);
  }

  if (isTaiwan) {
    add('accessory', ['ac_charm']);
    add('consumable', ['c_lime', 'c_cat', 'c_prayer']);
  }
  if (port.id === 'malacca' || port.id === 'batavia' || port.id === 'banten') {
    add('consumable', ['c_lime', 'c_cat']);
  }

  return {
    weapon: [...stock.weapon],
    armor: [...stock.armor],
    accessory: [...stock.accessory],
    consumable: [...stock.consumable],
  };
}

export function availableShipsAtPort(port: Port): ShipType[] {
  let ids: string[] = [];
  if (port.id === 'tayouan') {
    ids = ['caravel', 'fluyt', 'carrack', 'galleon'];
  } else if (port.region.includes('中國') || port.culture === 'han') {
    ids = ['junk_small', 'junk_large', 'fuchuan'];
  } else if (port.culture === 'wa') {
    ids = ['shuinsen'];
  } else if (port.id === 'manila') {
    ids = ['caravel', 'carrack', 'galleon'];
  } else if (port.id === 'malacca') {
    ids = ['caravel', 'carrack', 'fluyt'];
  } else if (port.id === 'batavia') {
    ids = ['fluyt', 'caravel'];
  } else if (port.culture === 'euro') {
    ids = ['caravel'];
  }
  return ids.map(shipTypeById);
}

// ---------- 海上狀態 ----------

export function hasSeaStatus(state: GameState, id: SeaStatusId): boolean {
  return state.statuses.some((x) => x.id === id && x.days > 0);
}

export function addSeaStatus(state: GameState, id: SeaStatusId, days: number): void {
  const found = state.statuses.find((x) => x.id === id);
  if (found) found.days = Math.max(found.days, days);
  else state.statuses.push({ id, days });
}

export function removeSeaStatus(state: GameState, id: SeaStatusId): void {
  state.statuses = state.statuses.filter((x) => x.id !== id);
}

export function statusSummary(state: GameState): string {
  const active = state.statuses.filter((x) => x.days > 0);
  if (active.length === 0) return '無';
  return active.map((x) => `${SEA_STATUS_DEFS[x.id].name}${x.days}天`).join('、');
}

export function useConsumable(state: GameState, itemId: string): string {
  const item = CONSUMABLES.find((x) => x.id === itemId);
  if (!item) return '找不到這個道具。';
  if (!hasInventory(state, itemId)) return `背包裡沒有【${item.name}】。`;

  if (item.effect === 'cure_scurvy') {
    if (!hasSeaStatus(state, 'scurvy')) return '船上目前沒有壞血病，不需要使用萊姆。';
    removeSeaStatus(state, 'scurvy');
    state.fatigue = Math.max(0, state.fatigue - 10);
  } else if (item.effect === 'catch_rats') {
    if (!hasSeaStatus(state, 'rats')) return '船上目前沒有鼠患，不需要放出船貓。';
    removeSeaStatus(state, 'rats');
  } else if (item.effect === 'calm_storm') {
    if (!hasSeaStatus(state, 'storm')) return '現在沒有暴風雨，不需要使用祈禱藥水。';
    removeSeaStatus(state, 'storm');
  } else if (item.effect === 'reduce_fatigue') {
    state.fatigue = Math.max(0, state.fatigue - 25);
    removeSeaStatus(state, 'homesick');
  } else if (item.effect === 'calm_crew') {
    if (!hasSeaStatus(state, 'mutiny')) return '船員現在沒有叛亂，不需要安撫酒。';
    removeSeaStatus(state, 'mutiny');
    state.fatigue = Math.max(0, state.fatigue - 10);
  }

  consumeInventory(state, itemId);
  return `使用了【${item.name}】。`;
}

/** 把舊版單一存檔（seagame_save1）搬到第 1 格（index 0），只搬一次。 */
function migrateLegacySave(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(slotKey(0))) {
      localStorage.setItem(slotKey(0), legacy);
    }
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* localStorage 不可用時略過 */
  }
}
migrateLegacySave();

/** 目前作用中的存檔格（0 起算）；自動存檔都寫到這一格。 */
export function getActiveSlot(): number {
  const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isInteger(n) && n >= 0 && n < SAVE_SLOT_COUNT ? n : 0;
}

export function setActiveSlot(slot: number): void {
  if (slot >= 0 && slot < SAVE_SLOT_COUNT) localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
}

/** 存檔到指定格（預設為作用中的格子）；存到哪格，之後的自動存檔就跟到哪格。 */
export function saveGame(state: GameState, slot: number = getActiveSlot()): void {
  setActiveSlot(slot);
  localStorage.setItem(slotKey(slot), JSON.stringify(state));
}

/** 讀取指定格（預設為作用中的格子）；含舊存檔升級。 */
export function loadGame(slot: number = getActiveSlot()): GameState | null {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return null;
  const s = migrateSave(raw);
  if (s) setActiveSlot(slot);
  return s;
}

/** 把存檔字串解析並升級到最新版本；解析失敗回 null。 */
function migrateSave(raw: string): GameState | null {
  try {
    const s = JSON.parse(raw) as Partial<GameState> & {
      ship?: { x?: number; y?: number; hull?: number; typeId?: string };
    };
    if (typeof s.gold !== 'number' || typeof s.day !== 'number') return null;
    // v3 以前的存檔：保留資金/日期/貨物，船與生存欄位用新預設（地圖/船制已改版）
    if (!s.version || s.version < 4) {
      const fresh = newGame();
      return {
        ...fresh,
        gold: s.gold,
        // v1~v3 的日期原本以 1624 年為第 1 天；M4 改為 1622 年起算，補 2 年保留顯示日期。
        day: s.day + 720,
        cargo: s.cargo ?? {},
        costBasis: (s as Partial<GameState>).costBasis ?? {},
        crew: (s as Partial<GameState>).crew ?? CREW_START,
        ship: {
          ...fresh.ship,
          x: s.version && s.version >= 2 && s.ship?.x ? s.ship.x : fresh.ship.x,
          y: s.version && s.version >= 2 && s.ship?.y ? s.ship.y : fresh.ship.y,
        },
      };
    }
    // v4 → v5：補艦隊／裝備／夥伴欄位
    if (s.version < 5) {
      const full = s as GameState;
      full.escorts = full.escorts ?? [];
      full.equip = full.equip ?? { weapon: null, armor: null, accessory: null };
      full.mates = full.mates ?? [];
      if (full.ship && (full.ship as PlayerShip).figurehead === undefined) {
        (full.ship as PlayerShip).figurehead = null;
      }
      full.version = 5;
    }
    // v5 → v6：補背包／海上持續狀態。已裝備物品自動補進背包，避免舊檔換裝時找不到。
    if (s.version < 6) {
      const full = s as GameState;
      full.inventory = full.inventory ?? {};
      full.statuses = full.statuses ?? [];
      const equipped = [full.equip?.weapon, full.equip?.armor, full.equip?.accessory, full.ship?.figurehead].filter(Boolean) as string[];
      for (const id of equipped) {
        if ((full.inventory[id] ?? 0) <= 0) full.inventory[id] = 1;
      }
      full.version = 6;
    }
    // v6 → v7：補首次進港的港口介紹紀錄
    if (s.version < 7) {
      const full = s as GameState;
      full.visitedPorts = full.visitedPorts ?? [];
      full.version = 7;
    }
    // v7 → v8：地圖已放大 2.4 倍，舊存檔的船座標失效（會卡在地圖角落／陸地），
    //           將艦隊移到大員外海，玩家讀檔後就停在大員，可直接入港。
    if (s.version < 8) {
      const full = s as GameState;
      const tayouan = PORTS.find((p) => p.id === 'tayouan');
      if (tayouan) {
        const px = tayouan.x;
        const py = tayouan.y + 40;
        full.ship.x = px;
        full.ship.y = py;
        for (const esc of full.escorts ?? []) {
          esc.x = px;
          esc.y = py;
        }
      }
      full.version = 8;
    }
    // v8 → v9：M4 主線導入，日期基準從 1624 改為 1622，舊檔補 2 年維持原本顯示日期。
    if (s.version < 9) {
      const full = s as GameState;
      full.day += 720;
      full.story = full.story ?? {
        heroId: 'lin',
        chapter: 1,
        completed: [],
        codex: [],
      };
      full.story.completed = full.story.completed ?? [];
      full.story.codex = full.story.codex ?? [];
      full.version = 9;
    }
    // v9 → v10：造船廠改為先建造、到期取船。
    if (s.version < 10) {
      const full = s as GameState;
      full.shipOrders = full.shipOrders ?? [];
      full.version = 10;
    }
    // v10 → v11：支線委託從單一運貨任務擴為採購／海戰／探索三分流。
    if (s.version < 11) {
      const full = s as GameState & { quest: Quest | (Omit<DeliveryQuest, 'type'> & { type?: string }) | null };
      const oldQuest = full.quest;
      if (oldQuest && typeof oldQuest === 'object' && !('type' in oldQuest)) {
        full.quest = { ...(oldQuest as Omit<DeliveryQuest, 'type'>), type: 'delivery' };
      }
      full.version = 11;
    }
    // v11 → v12：探索點改為問號揭露，需要記錄已確認探索點。
    if (s.version < 12) {
      const full = s as GameState;
      full.discoveredExplorationPoints = full.discoveredExplorationPoints ?? [];
      full.version = 12;
    }
    // v12 → v13：補探索次數與商館多任務候選紀錄。
    if (s.version < 13) {
      const full = s as GameState;
      full.exploration = full.exploration ?? {
        attempts: {},
        questOfferDay: 0,
        questOfferPortId: null,
        questOffers: [],
      };
      full.exploration.attempts = full.exploration.attempts ?? {};
      full.exploration.questOffers = full.exploration.questOffers ?? [];
      full.exploration.questOfferDay = full.exploration.questOfferDay ?? 0;
      full.exploration.questOfferPortId = full.exploration.questOfferPortId ?? null;
      full.version = 13;
    }
    // v13 → v14：新增船長等級與六圍能力值；舊檔依主角給 Lv1 預設能力。
    if (s.version < 14) {
      const full = s as GameState;
      if (!full.captain) {
        full.captain = { level: 1, xp: 0, stats: heroBaseStats(full.story?.heroId ?? 'lin') };
      }
      full.captain.stats = { ...heroBaseStats(full.story?.heroId ?? 'lin'), ...(full.captain.stats ?? {}) };
      full.version = 14;
    }
    // v14 → v15：新增船隻裝備（裝甲／船帆／大砲種類），舊船補 null。
    if (s.version < 15) {
      const full = s as GameState;
      const fixShip = (sh: PlayerShip | undefined) => {
        if (!sh) return;
        sh.armor = sh.armor ?? null;
        sh.sail = sh.sail ?? null;
        sh.cannonType = sh.cannonType ?? null;
      };
      fixShip(full.ship);
      (full.escorts ?? []).forEach(fixShip);
      full.version = 15;
    }
    // v15 → v16：新增交易動態（供需飽和 demand、流行 fad），舊檔補空值。
    if (s.version < 16) {
      const full = s as GameState;
      full.demand = full.demand ?? {};
      full.fad = full.fad ?? null;
      full.version = 16;
    }
    // v16 → v17：V3 地圖依精緻圖面重定位港口與海岸。
    // 舊檔若停在舊港口附近，移到同一港口的新靠岸點；遠洋船位保留，
    // 若剛好落在新陸地，WorldMapScene 仍會就近移到海面。
    if (s.version < MAP_REANCHOR_V3.saveVersion) {
      const full = s as GameState;
      const nearest = MAP_REANCHOR_V3.ports
        .map((port) => ({ port, distance: Math.hypot(full.ship.x - port.oldX, full.ship.y - port.oldY) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance <= 180) {
        const dx = nearest.port.newX - full.ship.x;
        const dy = nearest.port.newY - full.ship.y;
        full.ship.x = nearest.port.newX;
        full.ship.y = nearest.port.newY;
        for (const escort of full.escorts ?? []) {
          escort.x += dx;
          escort.y += dy;
        }
      }
      full.version = MAP_REANCHOR_V3.saveVersion;
    }
    // v17 → v18：聲望系統＋夥伴任務持久進度＋交易／海戰統計。
    // 冒險名聲依已確認探索點數回填（每點 6），避免老玩家歸零；
    // 曾確認西拉雅平原者回填新港社友好度 6。其餘統計從 0 起算。
    if (s.version < 18) {
      const full = s as GameState;
      const explored = full.discoveredExplorationPoints ?? [];
      full.reputation = full.reputation ?? { adventure: explored.length * 6, trade: 0, valor: 0 };
      full.friendship = full.friendship ?? (explored.includes('exp_siraya') ? { sinckan: 6 } : {});
      full.tradeStats = full.tradeStats ?? { total: 0, byPort: {} };
      full.battleWins = full.battleWins ?? 0;
      full.mateQuests = full.mateQuests ?? {};
      full.version = 18;
    }
    return s as GameState;
  } catch {
    return null;
  }
}

/** 指定格（預設作用中格子）是否有存檔。 */
export function hasSave(slot: number = getActiveSlot()): boolean {
  return localStorage.getItem(slotKey(slot)) !== null;
}

/** 是否有任何一格存在存檔。 */
export function hasAnySave(): boolean {
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    if (localStorage.getItem(slotKey(i))) return true;
  }
  return false;
}

/** 單一存檔格的摘要資訊（給存讀檔選單顯示）。 */
export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  heroName?: string;
  date?: string;
  gold?: number;
  chapter?: number;
}

export function saveSlotInfo(slot: number): SaveSlotInfo {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return { slot, exists: false };
  const s = migrateSave(raw);
  if (!s) return { slot, exists: false };
  const hero = heroDefById(s.story?.heroId);
  return {
    slot,
    exists: true,
    heroName: hero?.name,
    date: dateText(s.day),
    gold: s.gold,
    chapter: s.story?.chapter,
  };
}

export function listSaveSlots(): SaveSlotInfo[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => saveSlotInfo(i));
}

export function deleteSave(slot: number): void {
  localStorage.removeItem(slotKey(slot));
}

export function cargoCount(state: GameState): number {
  return Object.values(state.cargo).reduce((a, b) => a + b, 0);
}

// ---------- M4 主線／圖鑑 ----------

export function currentStoryChapter(state: GameState): StoryChapter | undefined {
  return STORY_CHAPTERS.find(
    (c) => c.heroId === state.story.heroId && c.chapter === state.story.chapter
  );
}

export function storyTargetPort(chapter: StoryChapter | undefined): Port | undefined {
  return chapter ? PORTS.find((p) => p.id === chapter.targetPortId) : undefined;
}

export function storyRequirementText(chapter: StoryChapter | undefined): string {
  if (!chapter?.requirements?.cargo?.length) return '條件：抵達指定港口即可推進。';
  const parts = chapter.requirements.cargo.map((req) => {
    const good = GOODS.find((g) => g.id === req.goodId);
    return `${req.consume ? '交付' : '持有'}【${good?.name ?? req.goodId}×${req.qty}】`;
  });
  return `條件：${parts.join('、')}。`;
}

function storyRequirementError(state: GameState, chapter: StoryChapter): string | null {
  for (const req of chapter.requirements?.cargo ?? []) {
    const have = state.cargo[req.goodId] ?? 0;
    if (have < req.qty) {
      const good = GOODS.find((g) => g.id === req.goodId);
      return `還缺【${good?.name ?? req.goodId}×${req.qty - have}】。${storyRequirementText(chapter)}`;
    }
  }
  return null;
}

function consumeStoryRequirements(state: GameState, chapter: StoryChapter): void {
  for (const req of chapter.requirements?.cargo ?? []) {
    if (!req.consume) continue;
    const have = state.cargo[req.goodId] ?? 0;
    const left = Math.max(0, have - req.qty);
    const basis = state.costBasis[req.goodId] ?? 0;
    state.cargo[req.goodId] = left;
    state.costBasis[req.goodId] = have > 0 ? Math.round(basis * (left / have)) : 0;
    if (left <= 0) {
      delete state.cargo[req.goodId];
      delete state.costBasis[req.goodId];
    }
  }
}

export function codexEntriesForState(state: GameState): CodexEntry[] {
  return state.story.codex
    .map((id) => CODEX_ENTRIES.find((entry) => entry.id === id))
    .filter((entry): entry is CodexEntry => Boolean(entry));
}

export function codexEntriesForCategory(state: GameState, categoryId: string): CodexListEntry[] {
  const unlocked = new Set(state.story.codex);
  return CODEX_ENTRIES
    .filter((entry) => (entry.category ?? entry.type) === categoryId)
    .map((entry) => ({ ...entry, unlocked: unlocked.has(entry.id) }));
}

/** 圖鑑收集率：已解鎖筆數／總筆數與百分比。 */
export function codexCollection(state: GameState): { unlocked: number; total: number; rate: number } {
  const total = CODEX_ENTRIES.length;
  const unlockedSet = new Set(state.story.codex);
  const unlocked = CODEX_ENTRIES.filter((e) => unlockedSet.has(e.id)).length;
  const rate = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return { unlocked, total, rate };
}

/** 依圖鑑收集率給予稱號；全收集為最高榮譽稱號。 */
export function codexTitle(state: GameState): string {
  const { unlocked, total, rate } = codexCollection(state);
  if (total > 0 && unlocked >= total) return '福爾摩沙活字典';
  if (rate >= 75) return '通曉四海的智者';
  if (rate >= 50) return '博學的船長';
  if (rate >= 25) return '識途的領航員';
  if (rate >= 10) return '見習航海者';
  return '初出海的見習生';
}

export function firstUnlockedCodexCategory(state: GameState): string {
  const unlocked = new Set(state.story.codex);
  return (
    CODEX_CATEGORIES.find((cat) => CODEX_ENTRIES.some((entry) => entry.category === cat.id && unlocked.has(entry.id)))?.id ??
    CODEX_CATEGORIES[0]?.id ??
    ''
  );
}

export function unlockCodex(state: GameState, ids: string[]): string[] {
  const unlocked: string[] = [];
  for (const id of ids) {
    if (!state.story.codex.includes(id)) {
      state.story.codex.push(id);
      const entry = CODEX_ENTRIES.find((x) => x.id === id);
      unlocked.push(entry?.title ?? id);
    }
  }
  return unlocked;
}

/** 章節前導文字：取劇本第一句旁白當作官府／商館的引言。 */
export function storyChapterTeaser(heroId: string, chapter: number): string {
  const script = getChapterScript(heroId, chapter);
  if (!script) return '';
  const intro = script.lines.find((l) => l.kind === 'narration') ?? script.lines.find((l) => l.kind === 'inner');
  return intro?.text ?? '';
}

/** 處理客座夥伴離隊：主線章節超過其同行窗口時自動離隊（不影響史實結局），回傳告別訊息。 */
export function processGuestDepartures(state: GameState): string[] {
  const messages: string[] = [];
  const remaining: typeof state.mates = [];
  for (const m of state.mates) {
    const def = mateDefById(m.id);
    if (def?.guest && state.story.chapter > def.guest.leaveAfterChapter) {
      messages.push(`${def.name}${def.guest.leaveText}`);
    } else {
      remaining.push(m);
    }
  }
  state.mates = remaining;
  return messages;
}

/** 不改動狀態的前置檢查：目前主線章節能否在這個港口推進。 */
export function storyAdvanceCheck(state: GameState, port: Port): { ok: boolean; message: string } {
  const chapter = currentStoryChapter(state);
  if (!chapter) return { ok: false, message: '主線章節已全部完成。' };
  if (chapter.targetPortId !== port.id) {
    const target = storyTargetPort(chapter);
    return { ok: false, message: `目前目標是前往【${target?.name ?? chapter.targetPortId}】。` };
  }
  const requirementError = storyRequirementError(state, chapter);
  if (requirementError) return { ok: false, message: requirementError };
  return { ok: true, message: '' };
}

export function completeStoryChapter(
  state: GameState,
  port: Port
): { ok: boolean; title: string; message: string } {
  const chapter = currentStoryChapter(state);
  if (!chapter) {
    return { ok: false, title: '主線暫告一段落', message: '目前可玩的主線章節已完成，後續章節會在 M4 繼續擴充。' };
  }
  if (chapter.targetPortId !== port.id) {
    const target = storyTargetPort(chapter);
    return { ok: false, title: chapter.title, message: `目前目標是前往【${target?.name ?? chapter.targetPortId}】。` };
  }
  const requirementError = storyRequirementError(state, chapter);
  if (requirementError) {
    return { ok: false, title: chapter.title, message: requirementError };
  }

  consumeStoryRequirements(state, chapter);
  const beforeDay = state.day;
  state.day = Math.max(state.day, dayForYear(chapter.year));
  state.story.completed.push(chapter.id);
  const unlocked = unlockCodex(state, chapterCodexIds(chapter.heroId, chapter.chapter));
  if (chapter.rewardGold > 0) state.gold += chapter.rewardGold;
  const xp = addXp(state, 400);
  state.story.chapter += 1;

  // 客座夥伴於劇情節點自動離隊
  const departures = processGuestDepartures(state);
  // 章節推進可能使進行中的夥伴任務階段達成
  const mateQuestMsgs = updateMateQuestProgress(state);

  const next = currentStoryChapter(state);
  const nextPort = storyTargetPort(next);
  const levelMsg = levelUpMessage(xp);
  const lines = [
    `第 ${chapter.chapter} 章「${chapter.title}」完成。`,
    state.day > beforeDay ? `劇情時間推進到 ${dateText(state.day)}。` : '',
    chapter.requirements?.cargo?.some((req) => req.consume) ? `${storyRequirementText(chapter)}已完成。` : '',
    chapter.rewardGold > 0 ? `獲得 ${chapter.rewardGold} 兩。` : '',
    unlocked.length > 0 ? `解鎖圖鑑：${unlocked.join('、')}` : '',
    levelMsg ? `\n${levelMsg}` : '',
    ...departures.map((d) => `\n${d}`),
    ...mateQuestMsgs.map((m) => `\n${m}`),
    next ? `\n下一章：${next.title}\n目標：前往【${nextPort?.name ?? next.targetPortId}】。` : '\n主線全部章節已完成，恭喜走完這條航路！仍可繼續自由貿易與探索。',
  ];
  return { ok: true, title: `完成：${chapter.title}`, message: lines.filter(Boolean).join('\n') };
}

// ---------- 日期 ----------

/** 一年 12 月、每月 30 天（簡化曆法） */
export function dateOf(day: number): { year: number; month: number; dom: number } {
  const d = day - 1;
  return {
    year: START_YEAR + Math.floor(d / 360),
    month: Math.floor((d % 360) / 30) + 1,
    dom: (d % 30) + 1,
  };
}

export function dateText(day: number): string {
  const { year, month, dom } = dateOf(day);
  return `${year}年${month}月${dom}日`;
}

// ---------- 雜湊亂數（同一天結果固定） ----------

function hashNoise(seedA: number, seedB: string): number {
  let h = seedA * 374761393;
  for (let i = 0; i < seedB.length; i++) {
    h = (h ^ seedB.charCodeAt(i)) * 16777619;
    h |= 0;
  }
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) | 0;
  return (Math.abs(h) % 10000) / 10000; // 0 ~ 0.9999
}

// ---------- 季風系統 ----------

export interface Wind {
  /** 風吹向的角度（弧度，0=向東，順時針） */
  dir: number;
  /** 強度 0.5~1.3 */
  strength: number;
  /** 風名（給 HUD 顯示） */
  name: string;
}

/**
 * 東亞季風（教育重點）：
 * 10~3月 東北季風（風從東北吹來 → 吹向西南）
 * 5~8月 西南季風（風從西南吹來 → 吹向東北）
 * 4、9月 季風交替，風向不定
 */
export function windOf(day: number): Wind {
  const { month } = dateOf(day);
  const jitter = (hashNoise(day, 'wind') - 0.5) * (Math.PI / 3); // ±30°
  const strength = 0.6 + hashNoise(day, 'windpow') * 0.6;
  if (month >= 10 || month <= 3) {
    return { dir: (Math.PI * 3) / 4 + jitter, strength, name: '東北季風' };
  }
  if (month >= 5 && month <= 8) {
    return { dir: -Math.PI / 4 + jitter, strength, name: '西南季風' };
  }
  const dir = hashNoise(day, 'winddir') * Math.PI * 2;
  return { dir, strength: strength * 0.7, name: '無定風' };
}

/** 航向相對風向的速度倍率：順風最快約 1.4x，逆風最慢約 0.65x */
export function windSpeedMod(headingDir: number, wind: Wind): number {
  const diff = Math.cos(headingDir - wind.dir);
  return 1 + 0.35 * diff * wind.strength;
}

/** 順風 / 側風 / 逆風 標籤 */
export function windLabel(headingDir: number, wind: Wind): string {
  const diff = Math.cos(headingDir - wind.dir);
  if (diff > 0.4) return '順風';
  if (diff < -0.4) return '逆風';
  return '側風';
}

// ---------- 價格 ----------

/** 某港口某商品在某一天的「市價／買價」（特產便宜、需求品貴、每日波動、行情事件加成）。
 *  賣價另見 sellPriceOf（含交涉加成、流行、供需飽和、原地洗錢防呆）。 */
export function priceOf(state: GameState, port: Port, goodId: string, day: number): number {
  const good = GOODS.find((g) => g.id === goodId);
  if (!good) return 0;
  let mod = 1.0;
  if (port.cheap.includes(goodId)) mod = 0.6;
  if (port.dear.includes(goodId)) mod = 1.5;
  const boosted = state.events.some(
    (e) => e.portId === port.id && e.goodId === goodId && e.untilDay >= day
  );
  if (boosted) mod *= 1.5;
  const noise = 1 + (hashNoise(day, port.id + '|' + goodId) - 0.5) * 0.16;
  return Math.max(1, Math.round(good.basePrice * mod * noise));
}

// ---- 交易動態：供需飽和、流行、賣價（v16） ----
const SAT_PER_UNIT = 0.003; // 每賣 1 件累積的供需飽和度（壓低後續賣價）
const SAT_MAX = 0.5; // 飽和上限：賣價最多被壓 50%
const SAT_RECOVER_PER_DAY = 0.018; // 每天回復的飽和度（約 28 天從滿回到 0）
const FAD_DAYS = 30; // 流行持續天數（約一個月）
const FAD_MULT = 2; // 流行時賣價倍率

/** 某港某貨目前的供需飽和度（0~SAT_MAX）：隨時間自動回復。 */
export function currentSaturation(state: GameState, portId: string, goodId: string, day: number): number {
  const e = state.demand?.[portId + '|' + goodId];
  if (!e) return 0;
  const decayed = e.sat - SAT_RECOVER_PER_DAY * Math.max(0, day - e.day);
  return Math.max(0, Math.min(SAT_MAX, decayed));
}

/**
 * 玩家在某港賣出某貨後：累積供需飽和度（壓低後續賣價）；
 * 傳入 revenue（成交總額）時同步累積交易統計、商人聲望（每 1000 兩 +1）並巡檢夥伴任務。
 * 回傳聲望／任務進度提示文字（可能為空陣列）。
 */
export function recordSale(state: GameState, port: Port, goodId: string, qty: number, day: number, revenue = 0): string[] {
  if (!state.demand) state.demand = {};
  const cur = currentSaturation(state, port.id, goodId, day);
  state.demand[port.id + '|' + goodId] = { sat: Math.min(SAT_MAX, cur + qty * SAT_PER_UNIT), day };
  const msgs: string[] = [];
  if (revenue > 0) {
    if (!state.tradeStats) state.tradeStats = { total: 0, byPort: {} };
    state.tradeStats.total += revenue;
    state.tradeStats.byPort[port.id] = (state.tradeStats.byPort[port.id] ?? 0) + revenue;
    const rep = addReputation(state, 'trade', Math.floor(revenue / 1000));
    if (rep) msgs.push(rep);
    msgs.push(...updateMateQuestProgress(state));
  }
  return msgs;
}

/** 該港該貨是否正在流行（賣價×2）：流行的貨必須是該港原本不販售的。 */
export function isFad(state: GameState, port: Port, goodId: string, day: number): boolean {
  const f = state.fad;
  return !!f && f.portId === port.id && f.goodId === goodId && f.untilDay >= day && !port.sells.includes(goodId);
}

/**
 * 賣價：市價 ×(1+交涉加成) ×流行倍率 ×(1−供需飽和)。
 * 防原地洗錢：凡「本港也販售」的貨物，賣價一律壓在市價（買價）的 0.9 以下，
 * 確保同港買進立刻賣出必定虧損。
 */
export function sellPriceOf(state: GameState, port: Port, goodId: string, day: number): number {
  const market = priceOf(state, port, goodId, day);
  let mult = 1 + tradeBonus(state);
  if (isFad(state, port, goodId, day)) mult *= FAD_MULT;
  mult *= 1 - currentSaturation(state, port.id, goodId, day);
  let price = Math.round(market * mult);
  if (port.sells.includes(goodId)) price = Math.min(price, Math.round(market * 0.9));
  return Math.max(1, price);
}

/** 每 7 天產生新行情事件（2 港需求大增）＋輪替流行事件，並清掉過期事件 */
export function refreshMarketEvents(state: GameState): void {
  // 流行事件輪替（先做，避免被下方 early-return 跳過）：全世界同時僅一個都市×商品流行。
  if (!state.fad || state.fad.untilDay < state.day) {
    const period = Math.floor(state.day / FAD_DAYS);
    const port = PORTS[Math.floor(hashNoise(period, 'fadp') * PORTS.length)];
    const pool = GOODS.filter((g) => !port.sells.includes(g.id));
    if (pool.length > 0) {
      const good = pool[Math.floor(hashNoise(period, 'fadg' + port.id) * pool.length)];
      state.fad = { portId: port.id, goodId: good.id, untilDay: state.day + FAD_DAYS };
    }
  }
  state.events = state.events.filter((e) => e.untilDay >= state.day);
  const week = Math.floor((state.day - 1) / 7);
  const have = state.events.length;
  if (have >= 2) return;
  for (let i = have; i < 2; i++) {
    const p = PORTS[Math.floor(hashNoise(week, 'evp' + i) * PORTS.length)];
    const dearPool = p.dear.length > 0 ? p.dear : GOODS.map((g) => g.id);
    const g = dearPool[Math.floor(hashNoise(week, 'evg' + i + p.id) * dearPool.length)];
    state.events.push({ portId: p.id, goodId: g, untilDay: state.day + 7 });
  }
}

// ---------- 委託任務 ----------

const PX_PER_DAY_EST = 220;

function pirateAreaForPort(port: Port): { name: string; x: number; y: number } {
  if (port.region.includes('日本')) return { name: '日本近海', x: 5400, y: 1220 };
  if (port.region === '琉球王國') return { name: '琉球航路', x: 4480, y: 2050 };
  if (port.region === '台灣' || port.region === '澎湖' || port.region.includes('福建')) {
    return { name: '台灣海峽', x: 3440, y: 2640 };
  }
  if (port.region.includes('廣東')) return { name: '珠江口外海', x: 2820, y: 3020 };
  if (port.region === '呂宋') return { name: '呂宋西岸', x: 3900, y: 3400 };
  if (port.region === '安南') return { name: '安南外海', x: 2820, y: 3820 };
  if (port.region === '暹羅' || port.region === '馬來半島') return { name: '麻六甲航路', x: 1600, y: 4700 };
  if (port.region === '爪哇') return { name: '巽他海峽', x: 2150, y: 5200 };
  if (port.region === '香料群島') return { name: '香料群島外海', x: 4240, y: 5240 };
  return { name: '近海航路', x: port.x, y: port.y + 120 };
}

// ---- 委託獎勵平衡 ----
// 風險階梯：採購 < 探索 < 海戰。
// 採購：需自備資金、最安全，獎勵覆蓋貨值並保證小利（買得便宜利潤更高）。
// 探索：消耗糧水與天數，另解鎖圖鑑與可能寶物，獎勵中等。
// 海戰：高風險（可能傷船減員），獎勵最高，另有戰鬥戰利品。
function deliveryReward(qty: number, basePrice: number, distDays: number): number {
  return Math.round(qty * basePrice * 1.1 + distDays * 60);
}
function combatReward(tier: number, distDays: number): number {
  return 800 + tier * 350 + distDays * 60;
}
function explorationReward(difficulty: number, distDays: number): number {
  return 550 + difficulty * 280 + distDays * 45;
}

function deliveryQuestOfferAt(state: GameState, port: Port, slot: number): DeliveryQuest {
  const candidates = PORTS.filter((p) => p.id !== port.id);
  const target = candidates[Math.floor(hashNoise(state.day + slot * 11, 'qp' + port.id + slot) * candidates.length)];
  const good = GOODS[Math.floor(hashNoise(state.day + slot * 13, 'qg' + port.id + slot) * GOODS.length)];
  const qty = 5 + Math.floor(hashNoise(state.day + slot * 17, 'qq' + port.id + slot) * 8);
  const distDays = Math.ceil(Math.hypot(target.x - port.x, target.y - port.y) / PX_PER_DAY_EST);
  const deadlineDay = state.day + distDays * 2 + 8;
  const reward = deliveryReward(qty, good.basePrice, distDays);
  return { type: 'delivery', goodId: good.id, qty, portId: target.id, deadlineDay, reward, originPortId: port.id };
}

function combatQuestOfferAt(state: GameState, port: Port, slot: number): CombatQuest {
  const area = pirateAreaForPort(port);
  const offsetX = (hashNoise(state.day + slot, 'piratex' + port.id) - 0.5) * 180;
  const offsetY = (hashNoise(state.day + slot, 'piratey' + port.id) - 0.5) * 180;
  const targetX = Math.max(20, Math.min(WORLD_W - 20, area.x + offsetX));
  const targetY = Math.max(20, Math.min(WORLD_H - 20, area.y + offsetY));
  const distDays = Math.max(1, Math.ceil(Math.hypot(targetX - port.x, targetY - port.y) / PX_PER_DAY_EST));
  const tier = state.day < 120 ? 1 : state.day < 300 ? 2 : 3;
  return {
    type: 'combat',
    title: `討伐${area.name}海盜`,
    originPortId: port.id,
    targetX,
    targetY,
    deadlineDay: state.day + distDays * 2 + 10,
    reward: combatReward(tier, distDays),
    enemyTier: tier,
    completed: false,
    codexIds: [],
  };
}

function explorationQuestOfferAt(state: GameState, port: Port, slot: number): ExplorationQuest {
  const nearby = EXPLORATION_POINTS.filter((point) => Math.hypot(point.x - port.x, point.y - port.y) <= 1900);
  const pool = nearby.length > 0 ? nearby : EXPLORATION_POINTS;
  const point = pool[Math.floor(hashNoise(state.day + slot * 19, 'qx' + port.id + slot) * pool.length)];
  const distDays = Math.max(1, Math.ceil(Math.hypot(point.x - port.x, point.y - port.y) / PX_PER_DAY_EST));
  const reward = explorationReward(point.difficulty, distDays);
  return {
    type: 'exploration',
    title: `調查${point.name}`,
    originPortId: port.id,
    pointId: point.id,
    deadlineDay: state.day + distDays * 2 + 14,
    reward,
    completed: false,
    codexIds: [],
  };
}

export function questOffersForPort(state: GameState, port: Port): Quest[] {
  const cache = state.exploration;
  if (
    cache.questOfferDay === state.day &&
    cache.questOfferPortId === port.id &&
    cache.questOffers.length === 3
  ) {
    return cache.questOffers;
  }
  const offers = [
    deliveryQuestOfferAt(state, port, 0),
    combatQuestOfferAt(state, port, 1),
    explorationQuestOfferAt(state, port, 2),
  ];
  const start = Math.floor(hashNoise(state.day, 'qorder' + port.id) * offers.length);
  const ordered = [...offers.slice(start), ...offers.slice(0, start)];
  cache.questOfferDay = state.day;
  cache.questOfferPortId = port.id;
  cache.questOffers = ordered;
  return ordered;
}

export function explorationAttemptCount(state: GameState, pointId: string): number {
  return state.exploration.attempts[pointId] ?? 0;
}

export function recordExplorationAttempt(state: GameState, pointId: string): number {
  const next = explorationAttemptCount(state, pointId) + 1;
  state.exploration.attempts[pointId] = next;
  return next;
}

export function explorationFindChance(state: GameState, point: ExplorationPoint): number {
  const base = point.difficulty <= 1 ? 0.72 : point.difficulty === 2 ? 0.58 : 0.44;
  const guide = hasRole(state, 'guide') ? 0.16 : 0;
  const scholar = hasRole(state, 'scholar') ? 0.08 : 0;
  const telescope = accessoryEffect(state) === 'scout' ? 0.08 : 0;
  const retry = Math.min(0.2, explorationAttemptCount(state, point.id) * 0.05);
  const know = Math.min(0.15, fleetStat(state, 'kno') / 600); // 知識能力加成
  return Math.max(0.25, Math.min(0.92, base + guide + scholar + telescope + retry + know));
}

export function explorationCostForState(state: GameState, point: ExplorationPoint): { food: number; water: number; days: number } {
  const guideMod = hasRole(state, 'guide') ? 0.75 : 1;
  const days = Math.max(1, Math.round(point.baseDays * guideMod));
  return {
    food: Math.max(1, Math.ceil(point.cost.food * guideMod)),
    water: Math.max(1, Math.ceil(point.cost.water * guideMod)),
    days,
  };
}

export function explorationFatigueGain(state: GameState, point: ExplorationPoint): number {
  const surgeonMod = hasRole(state, 'surgeon') ? 0.7 : 1;
  return Math.round(point.difficulty * 8 * surgeonMod);
}

export function explorationPointById(id: string): ExplorationPoint | undefined {
  return EXPLORATION_POINTS.find((point) => point.id === id);
}

export function discoveryById(id: string): DiscoveryEntry | undefined {
  return DISCOVERIES.find((entry) => entry.id === id);
}

export function questTitle(q: Quest): string {
  if (q.type === 'delivery') {
    const target = PORTS.find((p) => p.id === q.portId);
    const good = GOODS.find((g) => g.id === q.goodId);
    return `採購：${good?.name ?? q.goodId}送往${target?.name ?? q.portId}`;
  }
  return q.title;
}

export function questProgressText(state: GameState, q: Quest): string {
  if (q.type === 'delivery') {
    const target = PORTS.find((p) => p.id === q.portId);
    const good = GOODS.find((g) => g.id === q.goodId);
    const have = state.cargo[q.goodId] ?? 0;
    return `採購任務：送【${good?.name ?? q.goodId}×${q.qty}】到【${target?.name ?? q.portId}】\n持有：${have}/${q.qty}　期限：${dateText(q.deadlineDay)}　酬勞：${q.reward} 兩`;
  }
  if (q.type === 'combat') {
    return `海戰任務：${q.title}\n前往海上骷髏標記，擊退海盜後回到接任務的官府／商館領賞。\n期限：${dateText(q.deadlineDay)}　酬勞：${q.reward} 兩　狀態：${q.completed ? '已討伐，回報中' : '尚未討伐'}`;
  }
  const point = explorationPointById(q.pointId);
  return `探險任務：${q.title}\n前往【${point?.name ?? q.pointId}】探索，完成後回到接任務的官府／商館領賞。\n期限：${dateText(q.deadlineDay)}　酬勞：${q.reward} 兩　狀態：${q.completed ? '已完成，回報中' : '尚未完成'}`;
}

/** 酒館傳聞文字 */
export function rumorTexts(state: GameState): string[] {
  const lines: string[] = [];
  for (const e of state.events) {
    const p = PORTS.find((x) => x.id === e.portId);
    const g = GOODS.find((x) => x.id === e.goodId);
    if (p && g) lines.push(`聽說【${p.name}】最近缺${g.name}，價錢開得很高！`);
  }
  if (lines.length === 0) lines.push('最近海上風平浪靜，沒什麼特別的消息。');
  return lines;
}
