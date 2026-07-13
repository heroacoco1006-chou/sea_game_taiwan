// 用法：node --experimental-loader ./tools/node-ts-json-loader.mjs tools/simulate-battle-hex.mjs
import { pathToFileURL } from 'node:url';
import mapsData from '../src/data/battleMaps.json' with { type: 'json' };

const rules = await import('../src/battle/battleRules.ts');
const engine = await import('../src/battle/battleEngine.ts');
const ai = await import('../src/battle/battleAi.ts');
const hex = await import('../src/battle/hex.ts');

const SIZE_ORDER = ['medium', 'large', 'medium', 'small', 'small'];
const SIZE_STATS = {
  small: { movePoints: 4, hullMax: 80, cannons: 3 },
  medium: { movePoints: 3, hullMax: 100, cannons: 5 },
  large: { movePoints: 2, hullMax: 140, cannons: 8 },
};
const CANNON_TYPES = ['standard', 'ct_folang', 'ct_scatter', 'ct_hongyi'];

export function buildSimulationUnits(map, seed = 1) {
  const units = [];
  for (const side of ['player', 'enemy']) {
    const cells = rules.deploymentHexes(map, side);
    cells.forEach((cell, index) => {
      const size = SIZE_ORDER[index % SIZE_ORDER.length];
      const stats = SIZE_STATS[size];
      const variant = seed + index * 7 + (side === 'enemy' ? 17 : 0);
      const lowHull = variant % 13 === 0;
      units.push({
        id: `${side === 'player' ? 'p' : 'e'}${index}`,
        side,
        shipTypeId: `simulation_${size}`,
        shipSize: size,
        flagship: index === 1,
        hex: { ...cell },
        facing: side === 'player' ? 0 : 3,
        hull: lowHull ? Math.max(1, Math.floor(stats.hullMax * 0.2)) : stats.hullMax,
        hullMax: stats.hullMax,
        cannons: stats.cannons,
        cannonTypeId: CANNON_TYPES[variant % CANNON_TYPES.length],
        cannonPower: 1,
        gunnerMod: 1 + (variant % 3) * 0.04,
        armorMultiplier: 1,
        crew: 24 + (variant % 5) * 4,
        boardingBonus: variant % 4 === 0 ? 8 : 0,
        crewLossMultiplier: 1,
        movePoints: stats.movePoints,
        moveSpent: 0,
        moved: false,
        acted: false,
        repaired: false,
        status: 'active',
      });
    });
  }
  return units;
}

export function assertBattleStateValid(state, map) {
  if (state.round < 1 || state.round > state.maxRounds) throw new Error(`INVALID_ROUND:${state.round}`);
  const occupied = new Set();
  for (const unit of state.units) {
    if (!Number.isFinite(unit.hull) || unit.hull < 0 || unit.hull > unit.hullMax) throw new Error(`INVALID_HULL:${unit.id}`);
    if (!Number.isFinite(unit.crew) || unit.crew < 0) throw new Error(`INVALID_CREW:${unit.id}`);
    if (!['active', 'surrendered', 'sunk', 'retreated'].includes(unit.status)) throw new Error(`INVALID_STATUS:${unit.id}`);
    if (unit.status !== 'active') continue;
    if (!hex.hexInMap(unit.hex, map.width, map.height)) throw new Error(`OUT_OF_MAP:${unit.id}`);
    if (!rules.isPassable(map, unit.hex)) throw new Error(`IMPASSABLE_UNIT:${unit.id}`);
    const key = hex.hexKey(unit.hex);
    if (occupied.has(key)) throw new Error(`COLLISION:${key}`);
    occupied.add(key);
  }
}

export function simulateBattle({ seed, mapId = 'open_sea', maxCommands = 800 }) {
  const map = mapsData.maps.find((item) => item.id === mapId);
  if (!map) throw new Error(`UNKNOWN_MAP:${mapId}`);
  const rng = rules.createSeededRng(seed);
  let state = engine.createBattleState({ seed, mapId, units: buildSimulationUnits(map, seed) });
  const trace = [];
  assertBattleStateValid(state, map);

  for (let step = 0; step < maxCommands && state.winner === null; step += 1) {
    const decision = ai.chooseBattleAiDecision(state, map, state.activeSide);
    if (!decision) throw new Error(`AI_NO_DECISION:${seed}:${mapId}:${state.activeSide}`);
    const result = engine.applyCommand(state, map, decision.command, rng);
    if (!result.ok) {
      throw new Error(`AI_ILLEGAL_COMMAND:${seed}:${mapId}:${decision.reason}:${result.error}:${JSON.stringify(decision.command)}`);
    }
    trace.push({ round: state.round, side: state.activeSide, reason: decision.reason, command: decision.command });
    state = result.state;
    assertBattleStateValid(state, map);
  }

  if (state.winner === null) throw new Error(`AI_COMMAND_LIMIT:${seed}:${mapId}:${maxCommands}`);
  if (state.round > state.maxRounds) throw new Error(`AI_ROUND_LIMIT:${seed}:${mapId}:${state.round}`);
  return {
    seed,
    mapId,
    winner: state.winner,
    resultReason: state.resultReason,
    round: state.round,
    commandCount: trace.length,
    trace,
    log: state.log,
    units: state.units,
  };
}

export function simulateBatch(count = 120) {
  const mapIds = mapsData.maps.map((map) => map.id);
  const results = [];
  for (let index = 0; index < count; index += 1) {
    results.push(simulateBattle({ seed: 1000 + index, mapId: mapIds[index % mapIds.length] }));
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = simulateBatch(120);
  const maximumCommands = Math.max(...results.map((result) => result.commandCount));
  const maximumRound = Math.max(...results.map((result) => result.round));
  const outcomes = results.reduce((counts, result) => {
    counts[result.winner] = (counts[result.winner] ?? 0) + 1;
    return counts;
  }, {});
  console.log(`固定 seed 模擬 ${results.length} 場完成｜最長 ${maximumCommands} 指令｜最晚第 ${maximumRound} 回合結算`);
  console.log(`結果分布：${JSON.stringify(outcomes)}`);
  console.log('✅ P6 模擬無死循環、無非法命令、無非法狀態，全部在 12 回合內結算');
}
