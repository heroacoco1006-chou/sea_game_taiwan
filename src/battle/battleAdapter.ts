import data from '../data/battleEncounters.json';
import mapsData from '../data/battleMaps.json';
import {
  CANNON_TYPES,
  FIGUREHEADS,
  FLEET_MAX,
  HULL_PLATINGS,
  PORTS,
  addReputation,
  addXp,
  completeMateDuel,
  completeStoryDuel,
  fleetShips,
  fleetStat,
  levelUpMessage,
  reduceCrewLoss,
  shipTypeById,
  updateQuestProgress,
  weaponBoard,
} from '../state';
import type { GameState } from '../state';
import type {
  BattleMapDefinition,
  BattleState,
  BattleUnit,
  CannonTypeId,
  Facing,
  ShipSize,
  Side,
} from './battleTypes';
import { deploymentHexes } from './battleRules';

type EncounterKind = 'pirate' | 'quest' | 'story' | 'mate';
type ShipRow = [string, number, number, CannonTypeId?, string?];
interface EncounterDefinition {
  id: string;
  kind: EncounterKind;
  tier: number;
  mapId: string;
  loot: number;
  countWeights?: [number, number][];
  ships?: ShipRow[];
  fixedShips?: ShipRow[];
  matchNames?: string[];
  storyAllies?: ShipRow[];
}

const ENCOUNTERS = (data as unknown as { encounters: EncounterDefinition[] }).encounters;
const MAPS = (mapsData as { maps: BattleMapDefinition[] }).maps;

export interface HexBattleRequest {
  kind: EncounterKind;
  tier?: number;
  questCombat?: boolean;
  mateDuelId?: string;
  storyDuelChapterId?: string;
  duelName?: string;
}

export interface HexBattleLaunchData {
  mapId: string;
  seed: number;
  tier: number;
  units: BattleUnit[];
  unitNames: Record<string, string>;
  request: HexBattleRequest;
  encounterId: string;
  loot: number;
  playerShipIndexes: Record<string, number>;
}

export interface HexBattleSettlement {
  lines: string[];
  defeated: boolean;
}

function seededRoll(seed: number): number {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

function shipSize(typeId: string): ShipSize {
  const hull = shipTypeById(typeId).hullMax;
  return hull >= 180 ? 'large' : hull >= 120 ? 'medium' : 'small';
}

function movePoints(typeId: string): number {
  const speed = shipTypeById(typeId).speed;
  return speed >= 1.1 ? 4 : speed < 0.92 ? 2 : 3;
}

function findEncounter(request: HexBattleRequest): EncounterDefinition {
  const exact = ENCOUNTERS.find((entry) => (
    entry.kind === request.kind && entry.matchNames?.includes(request.duelName ?? '')
  ));
  return exact
    ?? ENCOUNTERS.find((entry) => entry.kind === request.kind && entry.tier === (request.tier ?? 1))
    ?? ENCOUNTERS.find((entry) => entry.kind === 'pirate' && entry.tier === (request.tier ?? 1))
    ?? ENCOUNTERS[0];
}

function distributeCrew(total: number, typeIds: string[]): number[] {
  const capacities = typeIds.map((id) => shipTypeById(id).maxCrew);
  const capacity = capacities.reduce((sum, value) => sum + value, 0);
  const usable = Math.max(typeIds.length, Math.min(total, capacity));
  const result = capacities.map((value) => Math.max(1, Math.floor(usable * value / capacity)));
  let remaining = usable - result.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % result.length, remaining -= 1) {
    result[index] += 1;
  }
  return result;
}

function baseUnit(
  side: Side,
  id: string,
  row: ShipRow,
  hex: BattleUnit['hex'],
  flagship: boolean,
  overrides: Partial<BattleUnit> = {},
): BattleUnit {
  const [typeId, cannons, crew, cannonTypeId = 'standard'] = row;
  const type = shipTypeById(typeId);
  return {
    id,
    side,
    shipTypeId: typeId,
    shipSize: shipSize(typeId),
    flagship,
    hex: { ...hex },
    facing: (side === 'player' ? 0 : 3) as Facing,
    hull: type.hullMax,
    hullMax: type.hullMax,
    cannons: Math.min(type.cannonSlots, Math.max(0, cannons)),
    cannonTypeId,
    cannonPower: 1,
    gunnerMod: 1,
    armorMultiplier: 1,
    crew,
    boardingBonus: 0,
    crewLossMultiplier: 1,
    movePoints: movePoints(typeId),
    moveSpent: 0,
    moved: false,
    acted: false,
    repaired: false,
    status: 'active',
    ...overrides,
  };
}

function enemyCount(encounter: EncounterDefinition, seed: number): number {
  if (encounter.fixedShips) return encounter.fixedShips.length;
  const weights = encounter.countWeights ?? [[1, 1]];
  const roll = seededRoll(seed);
  let cursor = 0;
  for (const [count, weight] of weights) {
    cursor += weight;
    if (roll < cursor) return count;
  }
  return weights[weights.length - 1][0];
}

// P7 pre-battle adapter: all four approved fleet rules converge here.
export function createHexBattleLaunch(
  state: GameState,
  request: HexBattleRequest,
  seed = state.day * 1009 + state.battleWins * 37 + 7,
): HexBattleLaunchData {
  const encounter = findEncounter(request);
  const map = MAPS.find((entry) => entry.id === encounter.mapId) ?? MAPS[0];
  const playerShips = fleetShips(state).slice(0, FLEET_MAX);
  const playerCells = deploymentHexes(map, 'player');
  const enemyCells = deploymentHexes(map, 'enemy');
  const crews = distributeCrew(state.crew, playerShips.map((ship) => ship.typeId));
  const unitNames: Record<string, string> = {};
  const playerShipIndexes: Record<string, number> = {};
  const units: BattleUnit[] = [];
  const gunnerMod = 1 + fleetStat(state, 'gun') / 300;
  const globalBoarding = weaponBoard(state)
    + Math.round(fleetStat(state, 'lead') / 15 + fleetStat(state, 'val') / 12);
  const crewLossMultiplier = reduceCrewLoss(state) ? 0.5 : 1;

  playerShips.forEach((ship, index) => {
    const id = `p${index}`;
    const type = shipTypeById(ship.typeId);
    const cannon = CANNON_TYPES.find((entry) => entry.id === ship.cannonType);
    const plating = HULL_PLATINGS.find((entry) => entry.id === ship.armor);
    const figurehead = FIGUREHEADS.find((entry) => entry.id === ship.figurehead);
    const hullMax = type.hullMax + (plating?.hullBonus ?? 0);
    const armorMultiplier = plating?.id === 'hp_copper' ? 0.78 : plating?.id === 'hp_iron' ? 0.88 : plating ? 0.94 : 1;
    playerShipIndexes[id] = index;
    unitNames[id] = index === 0
      ? `\u6211\u65b9\u65d7\u8266\uff1a${type.name}`
      : `\u6211\u65b9\u50da\u8266${index}\uff1a${type.name}`;
    units.push(baseUnit(
      'player',
      id,
      [ship.typeId, ship.cannons, crews[index], (cannon?.id ?? 'standard') as CannonTypeId],
      playerCells[index],
      index === 0,
      {
        hull: Math.max(1, Math.min(hullMax, ship.hull)),
        hullMax,
        cannonPower: figurehead?.effect === 'cannon' ? 1.25 : 1,
        gunnerMod,
        armorMultiplier,
        boardingBonus: globalBoarding + (cannon?.board ?? 0),
        crewLossMultiplier,
      },
    ));
  });

  const enemyRows = encounter.fixedShips ?? encounter.ships ?? [];
  enemyRows.slice(0, enemyCount(encounter, seed)).forEach((row, index) => {
    const id = `e${index}`;
    unitNames[id] = row[4] ?? (index === 0 ? '\u6575\u65b9\u65d7\u8266' : `\u6575\u65b9\u50da\u8266${index}`);
    units.push(baseUnit('enemy', id, row, enemyCells[index], index === 0));
  });

  const allyLimit = Math.max(0, FLEET_MAX - playerShips.length);
  const storyAllies = request.kind === 'story' ? (encounter.storyAllies ?? []) : [];
  storyAllies.slice(0, allyLimit).forEach((row, index) => {
    const id = `a${index}`;
    unitNames[id] = row[4] ?? `\u6545\u4e8b\u53cb\u8ecd${index + 1}`;
    units.push(baseUnit('player', id, row, playerCells[playerShips.length + index], false));
  });

  return {
    mapId: map.id,
    seed,
    tier: encounter.tier,
    units,
    unitNames,
    request,
    encounterId: encounter.id,
    loot: encounter.loot,
    playerShipIndexes,
  };
}

// P7 post-battle adapter: GameState is mutated only once after BattleState has ended.
export function settleHexBattle(
  state: GameState,
  launch: HexBattleLaunchData,
  battle: BattleState,
): HexBattleSettlement {
  const ownedUnits = battle.units.filter((unit) => launch.playerShipIndexes[unit.id] !== undefined);
  for (const unit of ownedUnits) {
    const ship = fleetShips(state)[launch.playerShipIndexes[unit.id]];
    ship.hull = Math.max(1, Math.min(unit.hullMax, unit.status === 'sunk' ? 1 : unit.hull));
  }
  state.crew = Math.max(1, ownedUnits
    .filter((unit) => unit.status !== 'sunk')
    .reduce((sum, unit) => sum + unit.crew, 0));
  state.fatigue = Math.min(100, state.fatigue + 5);

  if (battle.winner === 'player') {
    state.gold += launch.loot;
    if (launch.request.questCombat && state.quest?.type === 'combat') state.quest.completed = true;
    state.battleWins = (state.battleWins ?? 0) + 1;
    const reputation = addReputation(state, 'valor', 2 + launch.tier);
    const questLines = launch.request.storyDuelChapterId
      ? completeStoryDuel(state, launch.request.storyDuelChapterId)
      : launch.request.mateDuelId
        ? completeMateDuel(state, launch.request.mateDuelId)
        : updateQuestProgress(state);
    const level = levelUpMessage(addXp(state, 40 + Math.min(40, Math.round(launch.loot / 30))));
    return {
      defeated: false,
      lines: [
        `\u6230\u5229\u54c1\uff1a${launch.loot} \u5169\uff01`,
        launch.request.questCombat ? '\u6d77\u6230\u59d4\u8a17\u5df2\u5b8c\u6210\uff0c\u53ef\u56de\u5546\u9928\u9818\u8cde\u3002' : '',
        reputation,
        level,
        ...questLines,
      ].filter(Boolean),
    };
  }

  if (battle.winner === 'enemy') {
    let nearest = PORTS[0];
    let best = Number.POSITIVE_INFINITY;
    for (const port of PORTS) {
      const distance = (state.ship.x - port.x) ** 2 + (state.ship.y - port.y) ** 2;
      if (distance < best) {
        best = distance;
        nearest = port;
      }
    }
    const lost = Math.floor(state.gold * 0.3);
    state.gold -= lost;
    for (const ship of fleetShips(state)) {
      ship.hull = Math.max(1, Math.round(shipTypeById(ship.typeId).hullMax * 0.4));
    }
    state.food = Math.min(state.food, 10);
    state.water = Math.min(state.water, 10);
    state.ship.x = nearest.x;
    state.ship.y = nearest.y + 26;
    return {
      defeated: true,
      lines: [`\u8239\u968a\u88ab\u6551\u56de\u3010${nearest.name}\u3011\uff0c\u640d\u5931 ${lost} \u5169\u3002`],
    };
  }

  return {
    defeated: false,
    lines: ['\u96d9\u65b9\u812b\u96e2\u6230\u5834\uff0c\u672a\u7372\u5f97\u6230\u5229\u54c1\u3002'],
  };
}
