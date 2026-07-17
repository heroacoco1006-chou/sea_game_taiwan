import rulesData from '../data/battleRules.json';
import type {
  BattleErrorCode,
  BattleMapDefinition,
  BattleUnit,
  CannonTypeId,
  Facing,
  Hex,
  Side,
  Terrain,
} from './battleTypes';
import { HEX_DIRECTIONS, hexDistance, hexEqual, hexInMap, hexKey, hexLine, offsetToAxial } from './hex';

export type RandomSource = () => number;

export type RuleResult<T> = { ok: true; value: T } | { ok: false; error: BattleErrorCode };

export interface PathResult {
  cost: number;
  destination: Hex;
  facing: Facing;
}

export interface ReachableHex {
  hex: Hex;
  cost: number;
}

export interface BoardingResult {
  outcome: 'won' | 'balanced' | 'lost';
  attackerCrewLoss: number;
  targetCrewLoss: number;
}

export interface AutoBattleAssessment {
  enabled: boolean;
  playerPower: number;
  enemyPower: number;
  advantageRatio: number;
  requiredRatio: number;
  reason: 'available' | 'no_active_enemy' | 'insufficient_advantage';
}

export const BATTLE_RULES = rulesData;

export function createSeededRng(seed: number): RandomSource {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** 地圖資料檔的地形格是欄列座標；查詢時轉成 axial 比對（見 hex.ts offsetToAxial 說明）。 */
export function terrainAt(map: BattleMapDefinition, hex: Hex): Terrain {
  const found = map.terrain.find((cell) => hexEqual(offsetToAxial(cell.q, cell.r), hex));
  return found?.terrain ?? map.defaultTerrain;
}

/** 部署格資料同為欄列座標；回傳 axial 座標供顯示層與 adapter 共用。 */
export function deploymentHexes(map: BattleMapDefinition, side: Side): Hex[] {
  return map.deployments[side].map((cell) => offsetToAxial(cell.q, cell.r));
}

export function isPassable(map: BattleMapDefinition, hex: Hex): boolean {
  return hexInMap(hex, map.width, map.height) && BATTLE_RULES.terrain[terrainAt(map, hex)].passable;
}

export function movementCost(map: BattleMapDefinition, unit: BattleUnit, hex: Hex): number {
  const terrain = terrainAt(map, hex);
  if (terrain === 'shallow' && unit.shipSize === 'large') return BATTLE_RULES.movement.shallowLargeCost;
  if (terrain === 'shallow') return BATTLE_RULES.movement.shallowCost;
  return BATTLE_RULES.movement.deepCost;
}

function activeOccupiedKeys(units: BattleUnit[], exceptId?: string): Set<string> {
  return new Set(units
    .filter((unit) => unit.status === 'active' && unit.id !== exceptId)
    .map((unit) => hexKey(unit.hex)));
}

export function directionBetweenAdjacent(from: Hex, to: Hex): Facing | null {
  const index = HEX_DIRECTIONS.findIndex((direction) => from.q + direction.q === to.q && from.r + direction.r === to.r);
  return index < 0 ? null : index as Facing;
}

export function bearingFacing(from: Hex, to: Hex): Facing | null {
  if (hexEqual(from, to)) return null;
  const line = hexLine(from, to);
  return directionBetweenAdjacent(from, line[1]);
}

export function validatePath(
  map: BattleMapDefinition,
  units: BattleUnit[],
  unit: BattleUnit,
  path: Hex[],
): RuleResult<PathResult> {
  if (!Array.isArray(path) || path.length < 1 || !hexEqual(path[0], unit.hex)) return { ok: false, error: 'INVALID_PATH' };
  const occupied = activeOccupiedKeys(units, unit.id);
  let cost = 0;
  let facing = unit.facing;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const direction = directionBetweenAdjacent(previous, current);
    if (direction === null) return { ok: false, error: 'INVALID_PATH' };
    if (!hexInMap(current, map.width, map.height)) return { ok: false, error: 'OUT_OF_BOUNDS' };
    if (!isPassable(map, current)) return { ok: false, error: 'IMPASSABLE' };
    if (occupied.has(hexKey(current))) return { ok: false, error: 'OCCUPIED' };
    cost += movementCost(map, unit, current);
    facing = direction;
  }

  if (cost > unit.movePoints - unit.moveSpent) return { ok: false, error: 'INSUFFICIENT_MOVE' };
  return { ok: true, value: { cost, destination: { ...path[path.length - 1] }, facing } };
}

export function reachableHexes(map: BattleMapDefinition, units: BattleUnit[], unit: BattleUnit): ReachableHex[] {
  if (unit.status !== 'active' || unit.acted || unit.moved) return [];
  const budget = unit.movePoints - unit.moveSpent;
  if (budget < 0) return [];
  const occupied = activeOccupiedKeys(units, unit.id);
  const costs = new Map<string, number>([[hexKey(unit.hex), 0]]);
  const frontier: ReachableHex[] = [{ hex: { ...unit.hex }, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.hex.q - b.hex.q || a.hex.r - b.hex.r);
    const current = frontier.shift()!;
    if (current.cost !== costs.get(hexKey(current.hex))) continue;
    for (const direction of HEX_DIRECTIONS) {
      const next = { q: current.hex.q + direction.q, r: current.hex.r + direction.r };
      const key = hexKey(next);
      if (!hexInMap(next, map.width, map.height) || !isPassable(map, next) || occupied.has(key)) continue;
      const nextCost = current.cost + movementCost(map, unit, next);
      if (nextCost > budget || nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, nextCost);
      frontier.push({ hex: next, cost: nextCost });
    }
  }

  return [...costs.entries()]
    .filter(([key]) => key !== hexKey(unit.hex))
    .map(([key, cost]) => {
      const [q, r] = key.split(',').map(Number);
      return { hex: { q, r }, cost };
    })
    .sort((a, b) => a.cost - b.cost || a.hex.q - b.hex.q || a.hex.r - b.hex.r);
}

/**
 * 以與 reachableHexes 相同的成本規則找出到 destination 的最低成本路徑
 * （含起點、terminus 為 destination 的 axial 格串）；超出剩餘移動力或
 * 不可達回傳 null。給畫面畫「路徑預覽」用，Scene 不得自己重算。
 */
export function findPath(
  map: BattleMapDefinition,
  units: BattleUnit[],
  unit: BattleUnit,
  destination: Hex,
): Hex[] | null {
  if (hexEqual(destination, unit.hex)) return [{ ...unit.hex }];
  if (unit.status !== 'active' || unit.acted || unit.moved) return null;
  const budget = unit.movePoints - unit.moveSpent;
  if (budget <= 0) return null;
  const occupied = activeOccupiedKeys(units, unit.id);
  const costs = new Map<string, number>([[hexKey(unit.hex), 0]]);
  const previous = new Map<string, Hex>();
  const frontier: ReachableHex[] = [{ hex: { ...unit.hex }, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.hex.q - b.hex.q || a.hex.r - b.hex.r);
    const current = frontier.shift()!;
    if (current.cost !== costs.get(hexKey(current.hex))) continue;
    for (const direction of HEX_DIRECTIONS) {
      const next = { q: current.hex.q + direction.q, r: current.hex.r + direction.r };
      const key = hexKey(next);
      if (!hexInMap(next, map.width, map.height) || !isPassable(map, next) || occupied.has(key)) continue;
      const nextCost = current.cost + movementCost(map, unit, next);
      if (nextCost > budget || nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, nextCost);
      previous.set(key, { ...current.hex });
      frontier.push({ hex: next, cost: nextCost });
    }
  }

  if (!costs.has(hexKey(destination))) return null;
  const path: Hex[] = [{ ...destination }];
  let cursor = destination;
  while (!hexEqual(cursor, unit.hex)) {
    cursor = previous.get(hexKey(cursor))!;
    path.push({ ...cursor });
  }
  return path.reverse();
}

export function isBroadside(attacker: BattleUnit, target: BattleUnit): boolean {
  const bearing = bearingFacing(attacker.hex, target.hex);
  if (bearing === null) return false;
  const difference = (bearing - attacker.facing + 6) % 6;
  return difference !== 0 && difference !== 3;
}

export function hasLineOfSight(map: BattleMapDefinition, from: Hex, to: Hex): boolean {
  const line = hexLine(from, to);
  return line.slice(1, -1).every((hex) => !BATTLE_RULES.terrain[terrainAt(map, hex)].blocksLineOfSight);
}

export function validateCannonAttack(
  map: BattleMapDefinition,
  attacker: BattleUnit,
  target: BattleUnit,
): RuleResult<{ range: number }> {
  if (attacker.cannons <= 0) return { ok: false, error: 'NO_CANNONS' };
  const cannon = BATTLE_RULES.cannons[attacker.cannonTypeId as CannonTypeId];
  const range = hexDistance(attacker.hex, target.hex);
  if (range < cannon.minRange || range > cannon.maxRange) return { ok: false, error: 'OUT_OF_RANGE' };
  if (!isBroadside(attacker, target)) return { ok: false, error: 'NOT_BROADSIDE' };
  if (!hasLineOfSight(map, attacker.hex, target.hex)) return { ok: false, error: 'BLOCKED_LOS' };
  return { ok: true, value: { range } };
}

function targetBowSternModifier(attacker: BattleUnit, target: BattleUnit): number {
  const incoming = bearingFacing(target.hex, attacker.hex);
  if (incoming === null) return 1;
  const difference = (incoming - target.facing + 6) % 6;
  return difference === 0 || difference === 3 ? BATTLE_RULES.damage.bowSternModifier : 1;
}

export function cannonDamageBounds(attacker: BattleUnit, target: BattleUnit, range: number): { minimum: number; maximum: number } {
  const cannon = BATTLE_RULES.cannons[attacker.cannonTypeId as CannonTypeId];
  const rangeMod = BATTLE_RULES.damage.rangeModifiers[String(range) as '1' | '2' | '3'];
  const base = attacker.cannons
    * BATTLE_RULES.damage.basePerCannon
    * cannon.power
    * attacker.cannonPower
    * attacker.gunnerMod
    * rangeMod
    * target.armorMultiplier
    * targetBowSternModifier(attacker, target);
  return {
    minimum: Math.max(BATTLE_RULES.damage.minimum, Math.round(base * BATTLE_RULES.damage.randomMin)),
    maximum: Math.max(BATTLE_RULES.damage.minimum, Math.round(base * BATTLE_RULES.damage.randomMax)),
  };
}

export function rollCannonDamage(attacker: BattleUnit, target: BattleUnit, range: number, rng: RandomSource): number {
  const cannon = BATTLE_RULES.cannons[attacker.cannonTypeId as CannonTypeId];
  const rangeMod = BATTLE_RULES.damage.rangeModifiers[String(range) as '1' | '2' | '3'];
  const random = BATTLE_RULES.damage.randomMin + (BATTLE_RULES.damage.randomMax - BATTLE_RULES.damage.randomMin) * rng();
  const raw = attacker.cannons
    * BATTLE_RULES.damage.basePerCannon
    * cannon.power
    * attacker.cannonPower
    * attacker.gunnerMod
    * rangeMod
    * target.armorMultiplier
    * targetBowSternModifier(attacker, target)
    * random;
  return Math.max(BATTLE_RULES.damage.minimum, Math.round(raw));
}

function adjustedCrewLoss(crew: number, rate: number, multiplier: number): number {
  return Math.min(crew, Math.max(1, Math.round(crew * rate * multiplier)));
}

export function validateBoardingAttack(attacker: BattleUnit, target: BattleUnit): RuleResult<null> {
  if (hexDistance(attacker.hex, target.hex) !== 1) return { ok: false, error: 'NOT_ADJACENT' };
  // B-1 平衡（2026-07-16 老闆核定）：目標耐久需先被打到門檻以下才能跳幫，
  // 讓砲擊與走位成為接舷的前置，而不是開場貼臉一招通吃。
  if (target.hull > target.hullMax * BATTLE_RULES.boarding.requireHullBelow) {
    return { ok: false, error: 'TARGET_TOO_STURDY' };
  }
  return { ok: true, value: null };
}

export function resolveBoarding(attacker: BattleUnit, target: BattleUnit, rng: RandomSource): BoardingResult {
  const random = (minimum: number, maximum: number) => minimum + (maximum - minimum) * rng();
  const attackStrength = (attacker.crew + attacker.boardingBonus) * random(BATTLE_RULES.boarding.randomMin, BATTLE_RULES.boarding.randomMax);
  const targetStrength = (target.crew + target.boardingBonus) * random(BATTLE_RULES.boarding.randomMin, BATTLE_RULES.boarding.randomMax);
  const ratio = targetStrength <= 0 ? Number.POSITIVE_INFINITY : attackStrength / targetStrength;

  if (ratio >= BATTLE_RULES.boarding.decisiveRatio) {
    return {
      outcome: 'won',
      attackerCrewLoss: adjustedCrewLoss(attacker.crew, BATTLE_RULES.boarding.winnerCrewLossRate, attacker.crewLossMultiplier),
      targetCrewLoss: adjustedCrewLoss(target.crew, BATTLE_RULES.boarding.balancedCrewLossRate, target.crewLossMultiplier),
    };
  }
  if (ratio >= 1 / BATTLE_RULES.boarding.decisiveRatio) {
    return {
      outcome: 'balanced',
      attackerCrewLoss: adjustedCrewLoss(attacker.crew, BATTLE_RULES.boarding.balancedCrewLossRate, attacker.crewLossMultiplier),
      targetCrewLoss: adjustedCrewLoss(target.crew, BATTLE_RULES.boarding.balancedCrewLossRate, target.crewLossMultiplier),
    };
  }
  return {
    outcome: 'lost',
    attackerCrewLoss: adjustedCrewLoss(attacker.crew, BATTLE_RULES.boarding.failedCrewLossRate, attacker.crewLossMultiplier),
    targetCrewLoss: 0,
  };
}

/** 本場修理配額上限（B-6：累計修理不得超過耐久上限的 totalPercentCap）。 */
export function repairTotalCap(unit: BattleUnit): number {
  return Math.floor(unit.hullMax * BATTLE_RULES.repair.totalPercentCap);
}

/** 修理配額是否用罄（用罄後修整指令禁用）。 */
export function repairExhausted(unit: BattleUnit): boolean {
  return (unit.repairUsed ?? 0) >= repairTotalCap(unit);
}

/** 單次修理量：耐久上限的 hullPercent（夾 min/max），再受剩餘配額限制。 */
export function repairAmount(unit: BattleUnit): number {
  const amount = Math.round(unit.hullMax * BATTLE_RULES.repair.hullPercent);
  const clamped = Math.min(BATTLE_RULES.repair.maximum, Math.max(BATTLE_RULES.repair.minimum, amount));
  const remaining = Math.max(0, repairTotalCap(unit) - (unit.repairUsed ?? 0));
  return Math.min(clamped, remaining);
}

export function sideTurnLimitScore(units: BattleUnit[], side: Side): number {
  const sideUnits = units.filter((unit) => unit.side === side);
  const flagship = sideUnits.find((unit) => unit.flagship);
  const flagshipPercent = flagship && flagship.status === 'active' ? flagship.hull / flagship.hullMax * 100 : 0;
  const surviving = sideUnits.filter((unit) => unit.status === 'active').length;
  return flagshipPercent + surviving * 20;
}
/**
 * 自動戰鬥與 P7 戰前提示共用的艦隊戰力。只計算仍在場的船，公式固定在規則層，
 * Scene 與 adapter 不得各自重算：耐久＋砲數×砲種威力×基準傷害＋水手×0.5，
 * 旗艦整艘權重 1.2。
 */
export function sidePower(units: BattleUnit[], side: Side): number {
  return units
    .filter((unit) => unit.side === side && unit.status === 'active')
    .reduce((total, unit) => {
      const cannon = BATTLE_RULES.cannons[unit.cannonTypeId as CannonTypeId];
      const shipPower = unit.hull
        + unit.cannons * cannon.power * BATTLE_RULES.damage.basePerCannon
        + unit.crew * 0.5;
      return total + shipPower * (unit.flagship ? 1.2 : 1);
    }, 0);
}

/** 只在我方達到資料化優勢門檻時允許啟動；啟動後不因單次受傷而強制中止。 */
export function assessAutoBattle(units: BattleUnit[]): AutoBattleAssessment {
  const playerPower = sidePower(units, 'player');
  const enemyPower = sidePower(units, 'enemy');
  const requiredRatio = BATTLE_RULES.autoBattle.minAdvantageRatio;
  if (enemyPower <= 0) {
    return {
      enabled: false,
      playerPower,
      enemyPower,
      advantageRatio: Number.POSITIVE_INFINITY,
      requiredRatio,
      reason: 'no_active_enemy',
    };
  }
  const advantageRatio = playerPower / enemyPower;
  return {
    enabled: advantageRatio >= requiredRatio,
    playerPower,
    enemyPower,
    advantageRatio,
    requiredRatio,
    reason: advantageRatio >= requiredRatio ? 'available' : 'insufficient_advantage',
  };
}
