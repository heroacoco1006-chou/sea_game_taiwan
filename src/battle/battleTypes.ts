export type Side = 'player' | 'enemy';

export type Terrain = 'deep' | 'shallow' | 'land' | 'reef';

export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

export type ShipSize = 'small' | 'medium' | 'large';

export type CannonTypeId = 'standard' | 'ct_folang' | 'ct_scatter' | 'ct_hongyi';

export type BattlePhase =
  | 'setup'
  | 'player_select'
  | 'player_move_preview'
  | 'player_action_select'
  | 'player_target_select'
  | 'animating'
  | 'enemy_turn'
  | 'round_end'
  | 'result';

export type BattleUnitStatus = 'active' | 'surrendered' | 'sunk' | 'retreated';

export interface Hex {
  q: number;
  r: number;
}

export interface BattleUnit {
  id: string;
  side: Side;
  shipTypeId: string;
  shipSize: ShipSize;
  flagship: boolean;
  hex: Hex;
  facing: Facing;
  hull: number;
  hullMax: number;
  cannons: number;
  cannonTypeId: CannonTypeId;
  cannonPower: number;
  gunnerMod: number;
  armorMultiplier: number;
  crew: number;
  boardingBonus: number;
  crewLossMultiplier: number;
  movePoints: number;
  moveSpent: number;
  moved: boolean;
  acted: boolean;
  repaired: boolean;
  status: BattleUnitStatus;
}

export interface BattleLogEntry {
  round: number;
  side: Side;
  code: string;
  unitId?: string;
  targetId?: string;
  value?: number;
}

export interface BattleState {
  version: 1;
  seed: number;
  round: number;
  maxRounds: number;
  activeSide: Side;
  phase: BattlePhase;
  mapId: string;
  units: BattleUnit[];
  selectedUnitId: string | null;
  winner: Side | 'draw' | null;
  resultReason: string | null;
  log: BattleLogEntry[];
}

export type BattleCommand =
  | { type: 'select'; unitId: string }
  | { type: 'move'; unitId: string; path: Hex[] }
  | { type: 'turn'; unitId: string; facing: Facing }
  | { type: 'cannon'; attackerId: string; targetId: string }
  | { type: 'board'; attackerId: string; targetId: string }
  | { type: 'repair'; unitId: string }
  | { type: 'retreat'; unitId: string }
  | { type: 'wait'; unitId: string }
  | { type: 'end_turn' };

export type BattleEvent =
  | { type: 'unit_selected'; unitId: string }
  | { type: 'unit_moved'; unitId: string; from: Hex; to: Hex; path: Hex[] }
  | { type: 'unit_turned'; unitId: string; facing: Facing }
  | { type: 'cannon_fired'; attackerId: string; targetId: string; damage: number }
  | { type: 'boarding'; attackerId: string; targetId: string; outcome: 'won' | 'balanced' | 'lost' }
  | { type: 'crew_changed'; unitId: string; amount: number }
  | { type: 'unit_status_changed'; unitId: string; status: BattleUnitStatus }
  | { type: 'unit_repaired'; unitId: string; amount: number }
  | { type: 'unit_retreated'; unitId: string }
  | { type: 'unit_waited'; unitId: string }
  | { type: 'turn_ended'; side: Side; round: number }
  | { type: 'battle_ended'; winner: Side | 'draw'; reason: string };

export type BattleErrorCode =
  | 'BATTLE_OVER'
  | 'UNIT_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'WRONG_SIDE'
  | 'UNIT_INACTIVE'
  | 'FRIENDLY_TARGET'
  | 'ALREADY_MOVED'
  | 'ALREADY_ACTED'
  | 'INVALID_PATH'
  | 'OUT_OF_BOUNDS'
  | 'IMPASSABLE'
  | 'OCCUPIED'
  | 'INSUFFICIENT_MOVE'
  | 'INVALID_FACING'
  | 'NO_CANNONS'
  | 'OUT_OF_RANGE'
  | 'NOT_BROADSIDE'
  | 'BLOCKED_LOS'
  | 'NOT_ADJACENT'
  | 'REPAIR_ALREADY_USED'
  | 'FULL_HULL'
  | 'NOT_ON_RETREAT_EDGE';

/**
 * 地圖資料檔（battleMaps.json）內的 q/r 是「視覺欄／列」座標（q=第幾欄、r=第幾列），
 * 不是規則運算用的 axial 座標；讀入時必須經 hex.ts 的 offsetToAxial 轉換。
 * BattleUnit.hex 與引擎內部一律是 axial。
 */
export interface BattleMapCell extends Hex {
  terrain: Terrain;
}

export interface BattleMapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  defaultTerrain: Terrain;
  terrain: BattleMapCell[];
  deployments: Record<Side, Hex[]>;
  retreatEdges: Record<Side, 'west' | 'east'>;
}

export interface BattleMapsData {
  version: 1;
  maps: BattleMapDefinition[];
}
