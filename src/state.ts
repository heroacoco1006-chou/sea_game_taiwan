import goodsData from './data/goods.json';
import portsData from './data/ports.json';
import mapData from './data/map.json';

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

export interface GameState {
  version: number;
  gold: number;
  day: number; // 從 1 開始的絕對天數
  ship: { x: number; y: number; hull: number };
  cargo: Record<string, number>;
  food: number;
  water: number;
  events: MarketEvent[];
}

export const GOODS: Good[] = goodsData.goods;
export const PORTS: Port[] = portsData.ports;
export const LANDS: Land[] = mapData.lands;
export const LABELS: MapLabel[] = mapData.labels;
export const WORLD_W = mapData.worldWidth;
export const WORLD_H = mapData.worldHeight;

export const CARGO_MAX = 30;
export const HULL_MAX = 100;
export const SUPPLY_MAX = 60;
export const START_YEAR = 1624;

const SAVE_KEY = 'seagame_save1';
const START_POS = { x: 1340, y: 1075 }; // 月港外海

export function newGame(): GameState {
  return {
    version: 2,
    gold: 1000,
    day: 1,
    ship: { ...START_POS, hull: HULL_MAX },
    cargo: {},
    food: 30,
    water: 30,
    events: [],
  };
}

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<GameState> & { ship?: { x: number; y: number; hull?: number } };
    if (typeof s.gold !== 'number' || typeof s.day !== 'number') return null;
    // 舊版（M1）存檔升級：補上新欄位、座標重設到月港外海（地圖已換）
    if (!s.version || s.version < 2) {
      return {
        ...newGame(),
        gold: s.gold,
        day: s.day,
        cargo: s.cargo ?? {},
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
