import goodsData from './data/goods.json';
import portsData from './data/ports.json';
import mapData from './data/map.json';
import shipsData from './data/ships.json';
import equipData from './data/equipment.json';
import matesData from './data/mates.json';

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

/** 運送委託 */
export interface Quest {
  goodId: string;
  qty: number;
  portId: string;
  deadlineDay: number;
  reward: number;
}

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
export interface MateDef { id: string; name: string; from: string; portId: string; fee: number; roles: string[]; desc: string; }

export interface WeaponItem { id: string; name: string; price: number; board: number; desc: string; }
export interface ArmorItem { id: string; name: string; price: number; defense: number; desc: string; }
export interface AccessoryItem { id: string; name: string; price: number; effect: string; desc: string; }
export interface FigureheadItem { id: string; name: string; price: number; effect: string; desc: string; }
export interface ConsumableItem { id: string; name: string; price: number; effect: string; desc: string; }

export type ShopCat = 'weapon' | 'armor' | 'accessory' | 'consumable';
export type SeaStatusId = 'storm' | 'rats' | 'scurvy' | 'mutiny' | 'homesick';

export interface SeaStatus {
  id: SeaStatusId;
  days: number;
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
  quest: Quest | null;
  /** 主角個人裝備 */
  equip: Equip;
  /** 已招募的夥伴 */
  mates: Mate[];
  /** 背包：已購買的個人裝備、船首像、消耗品數量 */
  inventory: Record<string, number>;
  /** 海上持續狀態（每日結算，入港不會自動消失） */
  statuses: SeaStatus[];
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
export const CONSUMABLES: ConsumableItem[] = equipData.consumables;
export const ROLES: RoleDef[] = matesData.roles;
export const MATE_DEFS: MateDef[] = matesData.mates;
export const CREW_START = 16;
export const START_YEAR = 1624;
export const CANNON_PRICE = 3000;

export const SEA_STATUS_DEFS: Record<SeaStatusId, { name: string; desc: string }> = {
  storm: { name: '暴風雨', desc: '每天造成船體損傷，航速下降。可用祈禱藥水解除。' },
  rats: { name: '鼠患', desc: '老鼠偷吃糧食，食物消耗增加。可用船貓解除。' },
  scurvy: { name: '壞血病', desc: '船員疲勞快速上升，拖太久會有人倒下。可用萊姆解除。' },
  mutiny: { name: '船上叛亂', desc: '船員不聽指揮，航速下降且疲勞增加。可用安撫酒解除。' },
  homesick: { name: '思鄉病', desc: '長期離岸讓船員低落，疲勞增加。可用生薑藥湯緩解。' },
};

const SAVE_KEY = 'seagame_save1';
const START_POS = { x: 1340, y: 1075 }; // 月港外海

export function shipTypeById(id: string): ShipType {
  return SHIPS.find((t) => t.id === id) ?? SHIPS[0];
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
  return shipTypeOf(state).hullMax;
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

/** 全艦隊船體上限總和 */
export function fleetHullMax(state: GameState): number {
  return fleetShips(state).reduce((sum, sh) => sum + shipTypeById(sh.typeId).hullMax, 0);
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

export function newGame(): GameState {
  const type = SHIPS[0]; // 小戎克船
  return {
    version: 6,
    gold: 1000,
    day: 1,
    ship: {
      typeId: type.id,
      ...START_POS,
      hull: type.hullMax,
      cannons: 1,
      cargoSpace: 30,
      supplySpace: 30,
      figurehead: null,
    },
    escorts: [],
    cargo: {},
    costBasis: {},
    food: 30,
    water: 30,
    crew: CREW_START,
    fatigue: 0,
    daysAtSea: 0,
    events: [],
    quest: null,
    equip: { weapon: null, armor: null, accessory: null },
    mates: [],
    inventory: {},
    statuses: [],
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
  return b;
}

/** 暴風損害倍率（媽祖像減半＋航海長再減） */
export function stormDamageMod(state: GameState): number {
  let m = figureheadEffect(state) === 'storm' ? 0.5 : 1;
  if (hasRole(state, 'navigator')) m *= 0.8;
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
  return m;
}

/** 交易折扣比例（算盤飾品＋主計長夥伴）：買價×(1−d)、賣價×(1+d） */
export function tradeBonus(state: GameState): number {
  let d = accessoryEffect(state) === 'trade' ? 0.05 : 0;
  if (hasRole(state, 'purser')) d += 0.05;
  return d;
}

// ---------- 夥伴職位 ----------

export function mateDefById(id: string): MateDef | undefined {
  return MATE_DEFS.find((m) => m.id === id);
}

export function roleName(key: string | null): string {
  if (!key) return '（未指派）';
  return ROLES.find((r) => r.key === key)?.name ?? key;
}

/** 是否有夥伴擔任某職位 */
export function hasRole(state: GameState, roleKey: string): boolean {
  return state.mates.some((m) => m.role === roleKey);
}

/** 接舷額外戰力（副隊長） */
export function boardBonus(state: GameState): number {
  return hasRole(state, 'vice') ? 8 : 0;
}

/** 接舷減員是否獲得緩衝（醫師夥伴或重甲） */
export function reduceCrewLoss(state: GameState): boolean {
  return hasRole(state, 'surgeon') || armorDefense(state) >= 8;
}

// ---------- 背包／道具 ----------

export function itemNameById(id: string): string {
  return (
    WEAPONS.find((x) => x.id === id)?.name ??
    ARMORS.find((x) => x.id === id)?.name ??
    ACCESSORIES.find((x) => x.id === id)?.name ??
    FIGUREHEADS.find((x) => x.id === id)?.name ??
    CONSUMABLES.find((x) => x.id === id)?.name ??
    id
  );
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

export function shopItemIdsForPort(port: Port): Record<ShopCat, string[]> {
  const isTaiwan = port.region === '台灣' || port.region === '澎湖';
  const stock: Record<ShopCat, Set<string>> = {
    weapon: new Set(['w_knife']),
    armor: new Set(['a_cloth']),
    accessory: new Set(['ac_compass']),
    consumable: new Set(['c_lime']),
  };
  const add = (cat: ShopCat, ids: string[]) => ids.forEach((id) => stock[cat].add(id));

  if (port.culture === 'han') {
    add('weapon', ['w_saber']);
    add('armor', ['a_brigandine']);
    add('accessory', ['ac_abacus', 'ac_charm']);
    add('consumable', ['c_cat', 'c_ginger']);
  } else if (port.culture === 'wa') {
    add('weapon', ['w_katana']);
    add('armor', ['a_nanban']);
    add('accessory', ['ac_telescope']);
    add('consumable', ['c_cat', 'c_mediator']);
  } else if (port.culture === 'euro') {
    add('weapon', ['w_rapier', 'w_musket']);
    add('armor', ['a_leather']);
    add('accessory', ['ac_telescope']);
    add('consumable', ['c_prayer']);
  } else {
    add('armor', ['a_leather']);
    add('accessory', ['ac_charm']);
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

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
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
        day: s.day,
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
      return full;
    }
    return s as GameState;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function cargoCount(state: GameState): number {
  return Object.values(state.cargo).reduce((a, b) => a + b, 0);
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

/** 某港口某商品在某一天的市價（特產便宜、需求品貴、每日波動、行情事件加成） */
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

/** 每 7 天產生新的行情事件（2 個港口的需求大增），並清掉過期事件 */
export function refreshMarketEvents(state: GameState): void {
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

/** 產生本日此港的委託內容（同日同港固定） */
export function questOffer(state: GameState, port: Port): Quest {
  const candidates = PORTS.filter((p) => p.id !== port.id);
  const target = candidates[Math.floor(hashNoise(state.day, 'qp' + port.id) * candidates.length)];
  const good = GOODS[Math.floor(hashNoise(state.day, 'qg' + port.id) * GOODS.length)];
  const qty = 5 + Math.floor(hashNoise(state.day, 'qq' + port.id) * 8); // 5~12
  const distDays = Math.ceil(Math.hypot(target.x - port.x, target.y - port.y) / PX_PER_DAY_EST);
  const deadlineDay = state.day + distDays * 2 + 8;
  const reward = Math.round(qty * good.basePrice * 0.7 + distDays * 40);
  return { goodId: good.id, qty, portId: target.id, deadlineDay, reward };
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
