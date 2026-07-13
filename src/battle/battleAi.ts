import type {
  BattleCommand,
  BattleMapDefinition,
  BattleState,
  BattleUnit,
  Facing,
  Hex,
  Side,
} from './battleTypes';
import {
  BATTLE_RULES,
  cannonDamageBounds,
  findPath,
  reachableHexes,
  validateBoardingAttack,
  validateCannonAttack,
  validatePath,
} from './battleRules';
import { axialToOffset, hexDistance } from './hex';

export const AI_BOARDING_MIN_CHANCE = 0.65;
export const AI_RETREAT_HULL_RATIO = 0.25;

export type BattleAiReason =
  | 'sink_flagship'
  | 'board_advantage'
  | 'best_cannon'
  | 'retreat'
  | 'move_to_retreat'
  | 'move_to_attack'
  | 'turn'
  | 'wait'
  | 'end_turn';

export interface BattleAiDecision {
  command: BattleCommand;
  reason: BattleAiReason;
}

interface CannonCandidate {
  attacker: BattleUnit;
  target: BattleUnit;
  expectedDamage: number;
}

interface BoardingCandidate {
  attacker: BattleUnit;
  target: BattleUnit;
  winChance: number;
}

interface MoveCandidate {
  actor: BattleUnit;
  target: BattleUnit;
  destination: Hex;
  path: Hex[];
  cost: number;
  canAttack: boolean;
  distance: number;
}

function compareUnitPriority(a: BattleUnit, b: BattleUnit): number {
  if (a.flagship !== b.flagship) return a.flagship ? -1 : 1;
  if (a.hull !== b.hull) return a.hull - b.hull;
  return a.id.localeCompare(b.id);
}

function activeUnits(state: BattleState, side: Side): BattleUnit[] {
  return state.units
    .filter((unit) => unit.side === side && unit.status === 'active')
    .sort(compareUnitPriority);
}

function expectedCannonDamage(attacker: BattleUnit, target: BattleUnit, range: number): number {
  const bounds = cannonDamageBounds(attacker, target, range);
  return Math.round((bounds.minimum + bounds.maximum) / 2);
}

/**
 * 計算接舷「達到 decisiveRatio」的機率。雙方亂數皆為規則檔指定的均勻分布，
 * 此處用分段積分而不是抽樣，因此不消耗戰鬥 seed，也不會因平台或陣列順序漂移。
 */
export function estimateBoardingWinChance(attacker: BattleUnit, target: BattleUnit): number {
  const attackStrength = attacker.crew + attacker.boardingBonus;
  const targetStrength = target.crew + target.boardingBonus;
  if (targetStrength <= 0) return 1;
  if (attackStrength <= 0) return 0;

  const low = BATTLE_RULES.boarding.randomMin;
  const high = BATTLE_RULES.boarding.randomMax;
  const span = high - low;
  const threshold = BATTLE_RULES.boarding.decisiveRatio * targetStrength / attackStrength;
  if (span <= 0) return low / low >= threshold ? 1 : 0;

  const fullUpper = Math.min(high, low / threshold);
  const fullLength = Math.max(0, fullUpper - low);
  const middleLower = Math.max(low, low / threshold);
  const middleUpper = Math.min(high, high / threshold);
  let middleIntegral = 0;
  if (middleUpper > middleLower) {
    const width = middleUpper - middleLower;
    middleIntegral = (
      high * width
      - threshold * (middleUpper ** 2 - middleLower ** 2) / 2
    ) / span;
  }
  return Math.max(0, Math.min(1, (fullLength + middleIntegral) / span));
}

function cannonCandidates(state: BattleState, map: BattleMapDefinition, side: Side): CannonCandidate[] {
  const actors = activeUnits(state, side).filter((unit) => !unit.acted);
  const targets = activeUnits(state, side === 'player' ? 'enemy' : 'player');
  const candidates: CannonCandidate[] = [];
  for (const attacker of actors) {
    for (const target of targets) {
      const result = validateCannonAttack(map, attacker, target);
      if (!result.ok) continue;
      candidates.push({
        attacker,
        target,
        expectedDamage: expectedCannonDamage(attacker, target, result.value.range),
      });
    }
  }
  return candidates;
}

function boardingCandidates(state: BattleState, side: Side): BoardingCandidate[] {
  const actors = activeUnits(state, side).filter((unit) => !unit.acted);
  const targets = activeUnits(state, side === 'player' ? 'enemy' : 'player');
  const candidates: BoardingCandidate[] = [];
  for (const attacker of actors) {
    for (const target of targets) {
      if (!validateBoardingAttack(attacker, target).ok) continue;
      candidates.push({ attacker, target, winChance: estimateBoardingWinChance(attacker, target) });
    }
  }
  return candidates;
}

function compareCannonCandidate(a: CannonCandidate, b: CannonCandidate): number {
  return b.expectedDamage - a.expectedDamage
    || compareUnitPriority(a.target, b.target)
    || compareUnitPriority(a.attacker, b.attacker);
}

function compareBoardingCandidate(a: BoardingCandidate, b: BoardingCandidate): number {
  return b.winChance - a.winChance
    || compareUnitPriority(a.target, b.target)
    || compareUnitPriority(a.attacker, b.attacker);
}

function retreatEdgeDistance(map: BattleMapDefinition, side: Side, hex: Hex): number {
  const { col } = axialToOffset(hex);
  return map.retreatEdges[side] === 'west' ? col : map.width - 1 - col;
}

function retreatDecision(state: BattleState, map: BattleMapDefinition, side: Side): BattleAiDecision | null {
  const damaged = activeUnits(state, side)
    .filter((unit) => !unit.acted && unit.hull / unit.hullMax < AI_RETREAT_HULL_RATIO);
  for (const unit of damaged) {
    if (retreatEdgeDistance(map, side, unit.hex) === 0) {
      return { command: { type: 'retreat', unitId: unit.id }, reason: 'retreat' };
    }
    if (unit.moved) continue;
    const destination = reachableHexes(map, state.units, unit)
      .sort((a, b) => retreatEdgeDistance(map, side, a.hex) - retreatEdgeDistance(map, side, b.hex)
        || a.cost - b.cost
        || axialToOffset(a.hex).row - axialToOffset(b.hex).row
        || axialToOffset(a.hex).col - axialToOffset(b.hex).col)[0];
    if (!destination) continue;
    const path = findPath(map, state.units, unit, destination.hex);
    if (path) return { command: { type: 'move', unitId: unit.id, path }, reason: 'move_to_retreat' };
  }
  return null;
}

function movementDecision(state: BattleState, map: BattleMapDefinition, side: Side): BattleAiDecision | null {
  const actors = activeUnits(state, side).filter((unit) => !unit.acted && !unit.moved);
  const targets = activeUnits(state, side === 'player' ? 'enemy' : 'player');
  const candidates: MoveCandidate[] = [];

  for (const actor of actors) {
    for (const reachable of reachableHexes(map, state.units, actor)) {
      const path = findPath(map, state.units, actor, reachable.hex);
      if (!path) continue;
      const pathResult = validatePath(map, state.units, actor, path);
      if (!pathResult.ok) continue;
      const projected: BattleUnit = {
        ...actor,
        hex: { ...reachable.hex },
        facing: pathResult.value.facing,
      };
      for (const target of targets) {
        const canAttack = validateBoardingAttack(projected, target).ok
          || validateCannonAttack(map, projected, target).ok;
        candidates.push({
          actor,
          target,
          destination: { ...reachable.hex },
          path,
          cost: reachable.cost,
          canAttack,
          distance: hexDistance(reachable.hex, target.hex),
        });
      }
    }
  }

  candidates.sort((a, b) => Number(b.canAttack) - Number(a.canAttack)
    || a.distance - b.distance
    || compareUnitPriority(a.target, b.target)
    || a.cost - b.cost
    || compareUnitPriority(a.actor, b.actor)
    || a.destination.q - b.destination.q
    || a.destination.r - b.destination.r);
  const chosen = candidates[0];
  return chosen
    ? { command: { type: 'move', unitId: chosen.actor.id, path: chosen.path }, reason: 'move_to_attack' }
    : null;
}

function turnDecision(state: BattleState, map: BattleMapDefinition, side: Side): BattleAiDecision | null {
  const targets = activeUnits(state, side === 'player' ? 'enemy' : 'player');
  const actors = activeUnits(state, side).filter((unit) => (
    !unit.acted
    && !unit.moved
    && unit.moveSpent + BATTLE_RULES.movement.turnCost <= unit.movePoints
  ));
  for (const actor of actors) {
    const options = [
      ((actor.facing + 1) % 6) as Facing,
      ((actor.facing + 5) % 6) as Facing,
    ].map((facing) => {
      const projected = { ...actor, facing };
      const legal = targets.filter((target) => validateCannonAttack(map, projected, target).ok).length;
      return { facing, legal };
    }).sort((a, b) => b.legal - a.legal || a.facing - b.facing);
    return { command: { type: 'turn', unitId: actor.id, facing: options[0].facing }, reason: 'turn' };
  }
  return null;
}

/**
 * 只產生「下一個」命令，不改 state、不消耗亂數。呼叫端必須把 command 交給
 * battleEngine.applyCommand()；AI 不得繞過引擎直接寫入耐久、格位或勝敗。
 */
export function chooseBattleAiDecision(
  state: BattleState,
  map: BattleMapDefinition,
  side: Side = state.activeSide,
): BattleAiDecision | null {
  if (state.winner !== null || state.phase === 'result' || side !== state.activeSide) return null;
  const actors = activeUnits(state, side).filter((unit) => !unit.acted);
  if (actors.length === 0) return { command: { type: 'end_turn' }, reason: 'end_turn' };

  const cannons = cannonCandidates(state, map, side);
  const flagshipKill = cannons
    .filter((candidate) => candidate.target.flagship && candidate.expectedDamage >= candidate.target.hull)
    .sort(compareCannonCandidate)[0];
  if (flagshipKill) {
    return {
      command: { type: 'cannon', attackerId: flagshipKill.attacker.id, targetId: flagshipKill.target.id },
      reason: 'sink_flagship',
    };
  }

  const boarding = boardingCandidates(state, side)
    .filter((candidate) => candidate.winChance >= AI_BOARDING_MIN_CHANCE)
    .sort(compareBoardingCandidate)[0];
  if (boarding) {
    return {
      command: { type: 'board', attackerId: boarding.attacker.id, targetId: boarding.target.id },
      reason: 'board_advantage',
    };
  }

  const cannon = cannons.sort(compareCannonCandidate)[0];
  if (cannon) {
    return {
      command: { type: 'cannon', attackerId: cannon.attacker.id, targetId: cannon.target.id },
      reason: 'best_cannon',
    };
  }

  const retreat = retreatDecision(state, map, side);
  if (retreat) return retreat;
  const move = movementDecision(state, map, side);
  if (move) return move;
  const turn = turnDecision(state, map, side);
  if (turn) return turn;

  return { command: { type: 'wait', unitId: actors[0].id }, reason: 'wait' };
}
