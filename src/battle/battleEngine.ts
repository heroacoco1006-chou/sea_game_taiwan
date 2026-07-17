import type {
  BattleCommand,
  BattleErrorCode,
  BattleEvent,
  BattleLogEntry,
  BattleMapDefinition,
  BattleState,
  BattleUnit,
  Side,
} from './battleTypes';
import {
  BATTLE_RULES,
  type RandomSource,
  directionBetweenAdjacent,
  repairAmount,
  repairExhausted,
  resolveBoarding,
  rollCannonDamage,
  sideTurnLimitScore,
  validateBoardingAttack,
  validateCannonAttack,
  validatePath,
} from './battleRules';

export type ApplyCommandResult =
  | { ok: true; state: BattleState; events: BattleEvent[] }
  | { ok: false; state: BattleState; error: BattleErrorCode; events: [] };

export interface CreateBattleStateOptions {
  seed: number;
  mapId: string;
  units: BattleUnit[];
  maxRounds?: number;
}

export function createBattleState(options: CreateBattleStateOptions): BattleState {
  return {
    version: 1,
    seed: options.seed,
    round: 1,
    maxRounds: options.maxRounds ?? BATTLE_RULES.maxRounds,
    activeSide: 'player',
    phase: 'player_select',
    mapId: options.mapId,
    units: options.units.map((unit) => ({ ...unit, hex: { ...unit.hex } })),
    selectedUnitId: null,
    winner: null,
    resultReason: null,
    log: [],
  };
}

function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    units: state.units.map((unit) => ({
      ...unit,
      hex: { ...unit.hex },
      undo: unit.undo ? { ...unit.undo, hex: { ...unit.undo.hex } } : unit.undo,
    })),
    log: state.log.map((entry) => ({ ...entry })),
  };
}

function failure(state: BattleState, error: BattleErrorCode): ApplyCommandResult {
  return { ok: false, state, error, events: [] };
}

function actorId(command: BattleCommand): string | null {
  if ('unitId' in command) return command.unitId;
  if ('attackerId' in command) return command.attackerId;
  return null;
}

function findUnit(state: BattleState, id: string): BattleUnit | undefined {
  return state.units.find((unit) => unit.id === id);
}

function actorError(state: BattleState, unit: BattleUnit | undefined): BattleErrorCode | null {
  if (!unit) return 'UNIT_NOT_FOUND';
  if (unit.side !== state.activeSide) return 'WRONG_SIDE';
  if (unit.status !== 'active') return 'UNIT_INACTIVE';
  return null;
}

function targetError(attacker: BattleUnit, target: BattleUnit | undefined): BattleErrorCode | null {
  if (!target) return 'TARGET_NOT_FOUND';
  if (target.side === attacker.side) return 'FRIENDLY_TARGET';
  if (target.status !== 'active') return 'UNIT_INACTIVE';
  return null;
}

function pushLog(state: BattleState, code: string, unitId?: string, targetId?: string, value?: number): void {
  const entry: BattleLogEntry = { round: state.round, side: state.activeSide, code };
  if (unitId !== undefined) entry.unitId = unitId;
  if (targetId !== undefined) entry.targetId = targetId;
  if (value !== undefined) entry.value = value;
  state.log.push(entry);
}

function finishBattle(state: BattleState, events: BattleEvent[], winner: Side | 'draw', reason: string): void {
  state.winner = winner;
  state.resultReason = reason;
  state.phase = 'result';
  state.selectedUnitId = null;
  events.push({ type: 'battle_ended', winner, reason });
  pushLog(state, reason);
}

function evaluateBattleResult(state: BattleState, events: BattleEvent[]): void {
  if (state.winner !== null) return;
  const playerUnits = state.units.filter((unit) => unit.side === 'player');
  const enemyUnits = state.units.filter((unit) => unit.side === 'enemy');
  const playerFlagship = playerUnits.find((unit) => unit.flagship);
  const enemyFlagship = enemyUnits.find((unit) => unit.flagship);
  const defeated = (unit: BattleUnit | undefined) => unit?.status === 'sunk' || unit?.status === 'surrendered';
  const playerFlagshipDefeated = defeated(playerFlagship);
  const enemyFlagshipDefeated = defeated(enemyFlagship);

  if (playerFlagshipDefeated && enemyFlagshipDefeated) {
    finishBattle(state, events, 'draw', 'BOTH_FLAGSHIPS_LOST');
    return;
  }
  if (enemyFlagshipDefeated) {
    finishBattle(state, events, 'player', enemyFlagship?.status === 'sunk' ? 'ENEMY_FLAGSHIP_SUNK' : 'ENEMY_FLAGSHIP_SURRENDERED');
    return;
  }
  if (playerFlagshipDefeated) {
    finishBattle(state, events, 'enemy', playerFlagship?.status === 'sunk' ? 'PLAYER_FLAGSHIP_SUNK' : 'PLAYER_FLAGSHIP_SURRENDERED');
    return;
  }

  const activeEnemies = enemyUnits.filter((unit) => unit.status === 'active');
  if (activeEnemies.length === 0) {
    finishBattle(state, events, 'player', 'ALL_ENEMIES_REMOVED');
    return;
  }
  const activePlayers = playerUnits.filter((unit) => unit.status === 'active');
  if (activePlayers.length === 0) {
    const allRetreated = playerUnits.length > 0 && playerUnits.every((unit) => unit.status === 'retreated');
    finishBattle(state, events, allRetreated ? 'draw' : 'enemy', allRetreated ? 'PLAYER_RETREATED' : 'ALL_PLAYERS_REMOVED');
  }
}

function resetSideUnits(state: BattleState, side: Side): void {
  for (const unit of state.units) {
    if (unit.side !== side || unit.status !== 'active') continue;
    unit.moveSpent = 0;
    unit.moved = false;
    unit.acted = false;
    unit.repaired = false; // B-6：修整改為每回合可用（受累計配額 repairUsed 限制）
    unit.undo = null; // 反悔快照只在本回合行動前有效
  }
}

function endTurn(state: BattleState): ApplyCommandResult {
  const next = cloneState(state);
  const events: BattleEvent[] = [{ type: 'turn_ended', side: next.activeSide, round: next.round }];
  pushLog(next, 'TURN_ENDED');
  evaluateBattleResult(next, events);
  if (next.winner !== null) return { ok: true, state: next, events };

  if (next.activeSide === 'player') {
    next.activeSide = 'enemy';
    next.phase = 'enemy_turn';
    next.selectedUnitId = null;
    resetSideUnits(next, 'enemy');
    return { ok: true, state: next, events };
  }

  if (next.round >= next.maxRounds) {
    const playerScore = sideTurnLimitScore(next.units, 'player');
    const enemyScore = sideTurnLimitScore(next.units, 'enemy');
    finishBattle(next, events, playerScore > enemyScore ? 'player' : 'draw', playerScore > enemyScore ? 'TURN_LIMIT_PLAYER_WIN' : 'TURN_LIMIT_PLAYER_RETREAT');
    return { ok: true, state: next, events };
  }

  next.round += 1;
  next.activeSide = 'player';
  next.phase = 'player_select';
  next.selectedUnitId = null;
  resetSideUnits(next, 'player');
  return { ok: true, state: next, events };
}

export function applyCommand(
  state: BattleState,
  map: BattleMapDefinition,
  command: BattleCommand,
  rng: RandomSource,
): ApplyCommandResult {
  if (state.phase === 'result' || state.winner !== null) return failure(state, 'BATTLE_OVER');
  if (command.type === 'end_turn') return endTurn(state);

  const id = actorId(command);
  const unit = id === null ? undefined : findUnit(state, id);
  const invalidActor = actorError(state, unit);
  if (invalidActor) return failure(state, invalidActor);
  const actor = unit!;

  if (command.type === 'select') {
    const next = cloneState(state);
    next.selectedUnitId = actor.id;
    next.phase = next.activeSide === 'player' ? 'player_move_preview' : 'enemy_turn';
    const events: BattleEvent[] = [{ type: 'unit_selected', unitId: actor.id }];
    pushLog(next, 'UNIT_SELECTED', actor.id);
    return { ok: true, state: next, events };
  }

  if (command.type === 'move') {
    if (actor.moved) return failure(state, 'ALREADY_MOVED');
    if (actor.acted) return failure(state, 'ALREADY_ACTED');
    const path = validatePath(map, state.units, actor, command.path);
    if (!path.ok) return failure(state, path.error);
    const next = cloneState(state);
    const movedUnit = findUnit(next, actor.id)!;
    const from = { ...movedUnit.hex };
    // 反悔快照：行動確定前可用 undo_move 退回移動前的位置與朝向
    movedUnit.undo = { hex: { ...movedUnit.hex }, facing: movedUnit.facing, moveSpent: movedUnit.moveSpent };
    movedUnit.hex = { ...path.value.destination };
    movedUnit.facing = path.value.facing;
    movedUnit.moveSpent += path.value.cost;
    movedUnit.moved = true;
    next.selectedUnitId = movedUnit.id;
    next.phase = next.activeSide === 'player' ? 'player_action_select' : 'enemy_turn';
    const events: BattleEvent[] = [{ type: 'unit_moved', unitId: movedUnit.id, from, to: { ...movedUnit.hex }, path: command.path.map((hex) => ({ ...hex })) }];
    pushLog(next, 'UNIT_MOVED', movedUnit.id, undefined, path.value.cost);
    return { ok: true, state: next, events };
  }

  if (command.type === 'turn') {
    if (actor.moved) return failure(state, 'ALREADY_MOVED');
    if (actor.acted) return failure(state, 'ALREADY_ACTED');
    const difference = (command.facing - actor.facing + 6) % 6;
    if (difference !== 1 && difference !== 5) return failure(state, 'INVALID_FACING');
    if (actor.moveSpent + BATTLE_RULES.movement.turnCost > actor.movePoints) return failure(state, 'INSUFFICIENT_MOVE');
    const next = cloneState(state);
    const turned = findUnit(next, actor.id)!;
    turned.facing = command.facing;
    turned.moveSpent += BATTLE_RULES.movement.turnCost;
    next.selectedUnitId = turned.id;
    const events: BattleEvent[] = [{ type: 'unit_turned', unitId: turned.id, facing: turned.facing }];
    pushLog(next, 'UNIT_TURNED', turned.id, undefined, turned.facing);
    return { ok: true, state: next, events };
  }

  if (command.type === 'undo_move') {
    // 反悔移動（老闆 2026-07-16 核定）：移動後、行動前可退回原位原朝向，讓玩家有思考空間
    if (actor.acted) return failure(state, 'ALREADY_ACTED');
    if (!actor.moved || !actor.undo) return failure(state, 'NOTHING_TO_UNDO');
    const occupied = state.units.some((other) => (
      other.id !== actor.id && other.status === 'active'
      && other.hex.q === actor.undo!.hex.q && other.hex.r === actor.undo!.hex.r
    ));
    if (occupied) return failure(state, 'UNDO_BLOCKED');
    const next = cloneState(state);
    const reverted = findUnit(next, actor.id)!;
    reverted.hex = { ...reverted.undo!.hex };
    reverted.facing = reverted.undo!.facing;
    reverted.moveSpent = reverted.undo!.moveSpent;
    reverted.moved = false;
    reverted.undo = null;
    next.selectedUnitId = reverted.id;
    next.phase = next.activeSide === 'player' ? 'player_move_preview' : 'enemy_turn';
    const events: BattleEvent[] = [{ type: 'unit_move_undone', unitId: reverted.id, to: { ...reverted.hex }, facing: reverted.facing }];
    pushLog(next, 'MOVE_UNDONE', reverted.id);
    return { ok: true, state: next, events };
  }

  if (actor.acted) return failure(state, 'ALREADY_ACTED');

  if (command.type === 'cannon') {
    const target = findUnit(state, command.targetId);
    const invalidTarget = targetError(actor, target);
    if (invalidTarget) return failure(state, invalidTarget);
    const attack = validateCannonAttack(map, actor, target!);
    if (!attack.ok) return failure(state, attack.error);
    const next = cloneState(state);
    const attacker = findUnit(next, actor.id)!;
    const defender = findUnit(next, target!.id)!;
    const damage = rollCannonDamage(attacker, defender, attack.value.range, rng);
    attacker.acted = true;
    defender.hull = Math.max(0, defender.hull - damage);
    const events: BattleEvent[] = [{ type: 'cannon_fired', attackerId: attacker.id, targetId: defender.id, damage }];
    if (defender.hull === 0) {
      defender.status = 'sunk';
      events.push({ type: 'unit_status_changed', unitId: defender.id, status: 'sunk' });
    }
    pushLog(next, 'CANNON_FIRED', attacker.id, defender.id, damage);
    evaluateBattleResult(next, events);
    return { ok: true, state: next, events };
  }

  if (command.type === 'board') {
    const target = findUnit(state, command.targetId);
    const invalidTarget = targetError(actor, target);
    if (invalidTarget) return failure(state, invalidTarget);
    const boarding = validateBoardingAttack(actor, target!);
    if (!boarding.ok) return failure(state, boarding.error);
    const next = cloneState(state);
    const attacker = findUnit(next, actor.id)!;
    const defender = findUnit(next, target!.id)!;
    const result = resolveBoarding(attacker, defender, rng);
    attacker.acted = true;
    attacker.crew = Math.max(0, attacker.crew - result.attackerCrewLoss);
    defender.crew = Math.max(0, defender.crew - result.targetCrewLoss);
    const events: BattleEvent[] = [
      { type: 'boarding', attackerId: attacker.id, targetId: defender.id, outcome: result.outcome },
      { type: 'crew_changed', unitId: attacker.id, amount: -result.attackerCrewLoss },
    ];
    if (result.targetCrewLoss > 0) events.push({ type: 'crew_changed', unitId: defender.id, amount: -result.targetCrewLoss });
    if (result.outcome === 'won' || defender.crew === 0) {
      defender.status = 'surrendered';
      events.push({ type: 'unit_status_changed', unitId: defender.id, status: 'surrendered' });
    }
    if (attacker.crew === 0) {
      attacker.status = 'surrendered';
      events.push({ type: 'unit_status_changed', unitId: attacker.id, status: 'surrendered' });
    }
    pushLog(next, `BOARDING_${result.outcome.toUpperCase()}`, attacker.id, defender.id, result.targetCrewLoss);
    evaluateBattleResult(next, events);
    return { ok: true, state: next, events };
  }

  if (command.type === 'repair') {
    if (actor.repaired) return failure(state, 'REPAIR_ALREADY_USED');
    if (repairExhausted(actor)) return failure(state, 'REPAIR_EXHAUSTED'); // B-6：累計修理達 25% 上限
    if (actor.hull >= actor.hullMax) return failure(state, 'FULL_HULL');
    const next = cloneState(state);
    const repaired = findUnit(next, actor.id)!;
    const amount = Math.min(repairAmount(repaired), repaired.hullMax - repaired.hull);
    repaired.hull += amount;
    repaired.repairUsed = (repaired.repairUsed ?? 0) + amount;
    repaired.repaired = true;
    repaired.acted = true;
    const events: BattleEvent[] = [{ type: 'unit_repaired', unitId: repaired.id, amount }];
    pushLog(next, 'UNIT_REPAIRED', repaired.id, undefined, amount);
    return { ok: true, state: next, events };
  }

  if (command.type === 'retreat') {
    const onEdge = actor.side === 'player' ? actor.hex.q === 0 : actor.hex.q === map.width - 1;
    if (!onEdge) return failure(state, 'NOT_ON_RETREAT_EDGE');
    const next = cloneState(state);
    const retreated = findUnit(next, actor.id)!;
    retreated.status = 'retreated';
    retreated.acted = true;
    const events: BattleEvent[] = [
      { type: 'unit_retreated', unitId: retreated.id },
      { type: 'unit_status_changed', unitId: retreated.id, status: 'retreated' },
    ];
    pushLog(next, 'UNIT_RETREATED', retreated.id);
    evaluateBattleResult(next, events);
    return { ok: true, state: next, events };
  }

  const next = cloneState(state);
  const waiting = findUnit(next, actor.id)!;
  waiting.acted = true;
  const events: BattleEvent[] = [{ type: 'unit_waited', unitId: waiting.id }];
  pushLog(next, 'UNIT_WAITED', waiting.id);
  return { ok: true, state: next, events };
}
