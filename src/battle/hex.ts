import type { Facing, Hex } from './battleTypes';

export interface PixelPoint {
  x: number;
  y: number;
}

export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export function hexKey(hex: Hex): string {
  return `${hex.q},${hex.r}`;
}

export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexNeighbor(hex: Hex, facing: Facing): Hex {
  return hexAdd(hex, HEX_DIRECTIONS[facing]);
}

export function hexNeighbors(hex: Hex): Hex[] {
  return HEX_DIRECTIONS.map((direction) => hexAdd(hex, direction));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function assertHexSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new Error('HEX_SIZE_MUST_BE_POSITIVE');
}

export function axialToPixel(hex: Hex, size: number, origin: PixelPoint = { x: 0, y: 0 }): PixelPoint {
  assertHexSize(size);
  return {
    x: origin.x + size * 1.5 * hex.q,
    y: origin.y + size * Math.sqrt(3) * (hex.r + hex.q / 2),
  };
}

function roundAxial(q: number, r: number): Hex {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

  return { q: rx, r: rz };
}

export function pixelToAxial(point: PixelPoint, size: number, origin: PixelPoint = { x: 0, y: 0 }): Hex {
  assertHexSize(size);
  const x = point.x - origin.x;
  const y = point.y - origin.y;
  const q = (2 / 3 * x) / size;
  const r = (-x / 3 + Math.sqrt(3) / 3 * y) / size;
  return roundAxial(q, r);
}

/**
 * 地圖資料檔（battleMaps.json）的 (q,r) 是「視覺欄／列」（offset 座標；平頂六角格、
 * 奇數欄往下半格）。規則運算一律用 axial 座標：axial r = row − floor(col/2)。
 * 若把欄列直接當 axial 畫圖，11×7 戰場會歪成平行四邊形（右側整排低 5 格），
 * 所以讀入地形格／部署格時必須先經 offsetToAxial 轉換。
 */
export function offsetToAxial(col: number, row: number): Hex {
  return { q: col, r: row - Math.floor(col / 2) };
}

export function axialToOffset(hex: Hex): { col: number; row: number } {
  return { col: hex.q, row: hex.r + Math.floor(hex.q / 2) };
}

/**
 * axial 座標是否落在「width 欄 × height 列」的矩形戰場內。
 * 注意：矩形以欄列判定，不是 axial 座標的矩形（axial 矩形在畫面上不是矩形）。
 */
export function hexInMap(hex: Hex, width: number, height: number): boolean {
  if (!Number.isInteger(hex.q) || !Number.isInteger(hex.r)) return false;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return false;
  const { col, row } = axialToOffset(hex);
  return col >= 0 && col < width && row >= 0 && row < height;
}

export function hexLine(start: Hex, end: Hex): Hex[] {
  const distance = hexDistance(start, end);
  if (distance === 0) return [{ ...start }];

  const nudgedStart = { q: start.q + 1e-6, r: start.r + 2e-6 };
  const nudgedEnd = { q: end.q + 1e-6, r: end.r + 2e-6 };
  const result: Hex[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    result.push(roundAxial(
      nudgedStart.q + (nudgedEnd.q - nudgedStart.q) * t,
      nudgedStart.r + (nudgedEnd.r - nudgedStart.r) * t,
    ));
  }
  return result;
}
