import goodsData from './data/goods.json';
import portsData from './data/ports.json';

export interface Good {
  id: string;
  name: string;
  basePrice: number;
  desc: string;
}

export interface Port {
  id: string;
  name: string;
  x: number;
  y: number;
  region: string;
  desc: string;
  priceMod: Record<string, number>;
}

export interface GameState {
  gold: number;
  day: number;
  ship: { x: number; y: number };
  cargo: Record<string, number>;
}

export const GOODS: Good[] = goodsData.goods;
export const PORTS: Port[] = portsData.ports;
export const CARGO_MAX = 30;

const SAVE_KEY = 'seagame_save1';
const START_POS = { x: 340, y: 360 }; // 月港外海

export function newGame(): GameState {
  return {
    gold: 1000,
    day: 1,
    ship: { ...START_POS },
    cargo: {},
  };
}

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    if (typeof s.gold !== 'number' || typeof s.day !== 'number') return null;
    return s;
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

// 簡單的整數雜湊，讓「同一天、同港口、同商品」的價格固定，但每天會變動
function hashNoise(day: number, portId: string, goodId: string): number {
  let h = day * 374761393;
  const s = portId + '|' + goodId;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h |= 0;
  }
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) | 0;
  return (Math.abs(h) % 1000) / 1000; // 0 ~ 0.999
}

/** 某港口某商品在某一天的市價（含 ±8% 每日波動） */
export function priceOf(port: Port, goodId: string, day: number): number {
  const good = GOODS.find((g) => g.id === goodId);
  if (!good) return 0;
  const mod = port.priceMod[goodId] ?? 1.0;
  const noise = 1 + (hashNoise(day, port.id, goodId) - 0.5) * 0.16;
  return Math.max(1, Math.round(good.basePrice * mod * noise));
}
