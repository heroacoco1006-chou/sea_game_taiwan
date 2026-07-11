export type Side = 'player' | 'enemy';

export type Terrain = 'deep' | 'shallow' | 'land' | 'reef';

export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

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
  flagship: boolean;
  hex: Hex;
  facing: Facing;
  hull: number;
  hullMax: number;
  cannons: number;
  crew: number;
  movePoints: number;
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
  | { type: 'wait'; unitId: string }
  | { type: 'end_turn' };

export type BattleEvent =
  | { type: 'unit_selected'; unitId: string }
  | { type: 'unit_moved'; unitId: string; from: Hex; to: Hex; path: Hex[] }
  | { type: 'unit_turned'; unitId: string; facing: Facing }
  | { type: 'cannon_fired'; attackerId: string; targetId: string; damage: number }
  | { type: 'boarding'; attackerId: string; targetId: string }
  | { type: 'unit_repaired'; unitId: string; amount: number }
  | { type: 'unit_waited'; unitId: string }
  | { type: 'turn_ended'; side: Side; round: number }
  | { type: 'battle_ended'; winner: Side | 'draw'; reason: string };

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
