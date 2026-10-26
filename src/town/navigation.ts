import type { TownGroundPoint, TownSceneData } from './types';

const EPSILON = 1e-6;

export function groundDistance(a: TownGroundPoint, b: TownGroundPoint): number {
  return Math.hypot(a.u - b.u, a.v - b.v);
}

export function pointInPolygon(point: TownGroundPoint, polygon: TownGroundPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (distanceToSegment(point, a, b) <= EPSILON) return true;
    const crosses = (a.v > point.v) !== (b.v > point.v)
      && point.u < ((b.u - a.u) * (point.v - a.v)) / (b.v - a.v) + a.u;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(point: TownGroundPoint, a: TownGroundPoint, b: TownGroundPoint): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const lengthSquared = du * du + dv * dv;
  if (lengthSquared <= EPSILON) return groundDistance(point, a);
  const t = Math.max(0, Math.min(1, ((point.u - a.u) * du + (point.v - a.v) * dv) / lengthSquared));
  return Math.hypot(point.u - (a.u + du * t), point.v - (a.v + dv * t));
}

function distanceToPolygonEdges(point: TownGroundPoint, polygon: TownGroundPoint[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]));
  }
  return nearest;
}

export class TownNavigator {
  private readonly minU: number;
  private readonly maxU: number;
  private readonly minV: number;
  private readonly maxV: number;
  readonly radius: number;
  readonly step: number;

  constructor(private readonly data: TownSceneData) {
    const points = data.walkable.flat();
    this.minU = Math.min(...points.map((point) => point.u));
    this.maxU = Math.max(...points.map((point) => point.u));
    this.minV = Math.min(...points.map((point) => point.v));
    this.maxV = Math.max(...points.map((point) => point.v));
    this.radius = data.world.playerRadius;
    this.step = data.world.navigationStep;
  }

  isNavigable(point: TownGroundPoint): boolean {
    const containingWalkable = this.data.walkable.find((polygon) => pointInPolygon(point, polygon));
    if (!containingWalkable || distanceToPolygonEdges(point, containingWalkable) + EPSILON < this.radius) return false;
    for (const obstacle of this.data.obstacles) {
      if (pointInPolygon(point, obstacle.polygon)) return false;
      if (distanceToPolygonEdges(point, obstacle.polygon) + EPSILON < this.radius) return false;
    }
    return true;
  }

  segmentIsNavigable(start: TownGroundPoint, end: TownGroundPoint): boolean {
    const distance = groundDistance(start, end);
    const samples = Math.max(1, Math.ceil(distance / Math.max(0.08, this.radius * 0.45)));
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      if (!this.isNavigable({ u: start.u + (end.u - start.u) * t, v: start.v + (end.v - start.v) * t })) return false;
    }
    return true;
  }

  nearestNavigable(point: TownGroundPoint): TownGroundPoint | null {
    if (this.isNavigable(point)) return { ...point };
    const origin = this.toGrid(point);
    const limit = Math.ceil(Math.max(this.data.world.width, this.data.world.height) / this.step);
    for (let ring = 1; ring <= limit; ring += 1) {
      const candidates: TownGroundPoint[] = [];
      for (let offset = -ring; offset <= ring; offset += 1) {
        candidates.push(this.fromGrid(origin.ix + offset, origin.iv - ring));
        candidates.push(this.fromGrid(origin.ix + offset, origin.iv + ring));
        candidates.push(this.fromGrid(origin.ix - ring, origin.iv + offset));
        candidates.push(this.fromGrid(origin.ix + ring, origin.iv + offset));
      }
      const found = candidates
        .filter((candidate) => this.isNavigable(candidate))
        .sort((a, b) => groundDistance(a, point) - groundDistance(b, point))[0];
      if (found) return found;
    }
    return null;
  }

  findPath(start: TownGroundPoint, requestedGoal: TownGroundPoint): TownGroundPoint[] | null {
    if (!this.isNavigable(start)) return null;
    const goal = this.nearestNavigable(requestedGoal);
    if (!goal) return null;
    if (this.segmentIsNavigable(start, goal)) return [goal];

    const startGrid = this.nearestGridNode(start);
    const goalGrid = this.nearestGridNode(goal);
    if (!startGrid || !goalGrid) return null;

    const startKey = this.gridKey(startGrid.ix, startGrid.iv);
    const goalKey = this.gridKey(goalGrid.ix, goalGrid.iv);
    const open = [startKey];
    const openSet = new Set(open);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([[startKey, this.gridDistance(startGrid, goalGrid)]]);

    while (open.length > 0) {
      open.sort((a, b) => (fScore.get(a) ?? Number.POSITIVE_INFINITY) - (fScore.get(b) ?? Number.POSITIVE_INFINITY));
      const current = open.shift()!;
      openSet.delete(current);
      if (current === goalKey) {
        const cells = this.reconstruct(cameFrom, current).map((key) => this.fromGridKey(key));
        const raw = [start, ...cells.slice(1), goal];
        return this.simplify(raw).slice(1);
      }

      const cell = this.parseGridKey(current);
      for (const neighbor of this.neighbors(cell.ix, cell.iv)) {
        const neighborKey = this.gridKey(neighbor.ix, neighbor.iv);
        const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY)
          + Math.hypot(neighbor.ix - cell.ix, neighbor.iv - cell.iv);
        if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + this.gridDistance(neighbor, goalGrid));
        if (!openSet.has(neighborKey)) {
          open.push(neighborKey);
          openSet.add(neighborKey);
        }
      }
    }
    return null;
  }

  moveWithCollision(start: TownGroundPoint, delta: TownGroundPoint): TownGroundPoint {
    const distance = Math.hypot(delta.u, delta.v);
    const parts = Math.max(1, Math.ceil(distance / Math.max(0.08, this.radius * 0.45)));
    let current = { ...start };
    for (let index = 0; index < parts; index += 1) {
      const du = delta.u / parts;
      const dv = delta.v / parts;
      const full = { u: current.u + du, v: current.v + dv };
      if (this.isNavigable(full)) {
        current = full;
        continue;
      }
      const slideU = { u: current.u + du, v: current.v };
      if (this.isNavigable(slideU)) current = slideU;
      const slideV = { u: current.u, v: current.v + dv };
      if (this.isNavigable(slideV)) current = slideV;
    }
    return current;
  }

  private neighbors(ix: number, iv: number): { ix: number; iv: number }[] {
    const result: { ix: number; iv: number }[] = [];
    for (let du = -1; du <= 1; du += 1) {
      for (let dv = -1; dv <= 1; dv += 1) {
        if (du === 0 && dv === 0) continue;
        const next = { ix: ix + du, iv: iv + dv };
        if (!this.isNavigable(this.fromGrid(next.ix, next.iv))) continue;
        if (du !== 0 && dv !== 0) {
          if (!this.isNavigable(this.fromGrid(ix + du, iv)) || !this.isNavigable(this.fromGrid(ix, iv + dv))) continue;
        }
        result.push(next);
      }
    }
    return result;
  }

  private nearestGridNode(point: TownGroundPoint): { ix: number; iv: number } | null {
    const grid = this.toGrid(point);
    if (this.isNavigable(this.fromGrid(grid.ix, grid.iv))) return grid;
    for (let ring = 1; ring <= 5; ring += 1) {
      for (let du = -ring; du <= ring; du += 1) {
        for (let dv = -ring; dv <= ring; dv += 1) {
          if (Math.max(Math.abs(du), Math.abs(dv)) !== ring) continue;
          const candidate = { ix: grid.ix + du, iv: grid.iv + dv };
          if (this.isNavigable(this.fromGrid(candidate.ix, candidate.iv))) return candidate;
        }
      }
    }
    return null;
  }

  private simplify(path: TownGroundPoint[]): TownGroundPoint[] {
    if (path.length <= 2) return path.map((point) => ({ ...point }));
    const simplified = [{ ...path[0] }];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let furthest = anchor + 1;
      for (let candidate = path.length - 1; candidate > anchor + 1; candidate -= 1) {
        if (this.segmentIsNavigable(path[anchor], path[candidate])) {
          furthest = candidate;
          break;
        }
      }
      simplified.push({ ...path[furthest] });
      anchor = furthest;
    }
    return simplified;
  }

  private reconstruct(cameFrom: Map<string, string>, goal: string): string[] {
    const path = [goal];
    let current = goal;
    while (cameFrom.has(current)) {
      current = cameFrom.get(current)!;
      path.unshift(current);
    }
    return path;
  }

  private toGrid(point: TownGroundPoint): { ix: number; iv: number } {
    return {
      ix: Math.round((point.u - this.minU) / this.step),
      iv: Math.round((point.v - this.minV) / this.step),
    };
  }

  private fromGrid(ix: number, iv: number): TownGroundPoint {
    return { u: this.minU + ix * this.step, v: this.minV + iv * this.step };
  }

  private gridKey(ix: number, iv: number): string {
    return `${ix},${iv}`;
  }

  private parseGridKey(key: string): { ix: number; iv: number } {
    const [ix, iv] = key.split(',').map(Number);
    return { ix, iv };
  }

  private fromGridKey(key: string): TownGroundPoint {
    const { ix, iv } = this.parseGridKey(key);
    return this.fromGrid(ix, iv);
  }

  private gridDistance(a: { ix: number; iv: number }, b: { ix: number; iv: number }): number {
    return Math.hypot(a.ix - b.ix, a.iv - b.iv);
  }
}
