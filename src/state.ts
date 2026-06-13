import goodsData from './data/goods.json';
import portsData from './data/ports.json';
import mapData from './data/map.json';
import shipsData from './data/ships.json';

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
}

export interface GameState {
  version: number;
  gold: number;
  day: number; // 從 1 開始的絕對天數
  ship: PlayerShip;
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
}

export const GOODS: Good[] = goodsData.goods;
export const PORTS: Port[] = portsData.ports;
export const LANDS: Land[] = mapData.lands;
export const LABELS: MapLabel[] = mapData.labels;
export const WORLD_W = mapData.worldWidth;
export const WORLD_H = mapData.worldHeight;

export const SHIPS: ShipType[] = shipsData.ships;
export const CREW_START = 16;
export const START_YEAR = 1624;
export const CANNON_PRICE = 100;

const SAVE_KEY = 'seagame_save1';
const START_POS = { x: 1340, y: 1075 }; // 月港外海

export function shipTypeOf(state: GameState): ShipType {
  return SHIPS.find((t) => t.id === state.ship.typeId) ?? SHIPS[0];
}

/** 貨艙上限＝商品艙空間 */
export function cargoMax(state: GameState): number {
  return state.ship.cargoSpace;
}

/** 糧／水上限＝糧水艙空間 */
export function supplyMax(state: GameState): number {
  return state.ship.supplySpace;
}

export function hullMax(state: GameState): number {
  return shipTypeOf(state).hullMax;
}

export function crewMax(state: GameState): number {
  return shipTypeOf(state).maxCrew;
}

export function newGame(): GameState {
  const type = SHIPS[0]; // 小戎克船
  return {
    version: 4,
    gold: 1000,
    day: 1,
    ship: {
      typeId: type.id,
      ...START_POS,
      hull: type.hullMax,
      cannons: 1,
      cargoSpace: 30,
      supplySpace: 30,
    },
    cargo: {},
    costBasis: {},
    food: 30,
    water: 30,
    crew: CREW_START,
    fatigue: 0,
    daysAtSea: 0,
    events: [],
    quest: null,
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
  const min = shipTypeOf(state).minCrew;
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
