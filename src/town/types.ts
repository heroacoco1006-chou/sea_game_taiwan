export interface TownMovementInput {
  x: number;
  y: number;
}

export interface TownGroundPoint {
  u: number;
  v: number;
}

export type TownFacilityKey = 'trade' | 'tavern' | 'inn' | 'office' | 'item' | 'shipyard' | 'harbor';

export interface TownFacilityData {
  key: TownFacilityKey;
  label: string;
  objectId: string;
  door: TownGroundPoint;
  approach: TownGroundPoint;
  interactionRadius: number;
}

export interface TownObjectData {
  id: string;
  assetId: string;
  at: TownGroundPoint;
  elevation: number;
  scale: number;
  rotationDeg: number;
  occlusion: 'solid' | 'fade' | 'none';
}

export interface TownSceneData {
  schemaVersion: 1;
  id: string;
  themeId: string;
  layoutRevision: string;
  world: { width: number; height: number; unitsToWorld: number; playerRadius: number; navigationStep: number };
  camera: { projection: 'orthographic'; pitchDeg: number; yawDeg: number; viewSpan: number };
  surfaces: { groundAssetId: string; waterAssetId: string };
  spawn: TownGroundPoint;
  walkable: TownGroundPoint[][];
  obstacles: { id: string; polygon: TownGroundPoint[] }[];
  facilities: TownFacilityData[];
  objects: TownObjectData[];
  ambience: { id: string; kind: 'water' | 'flag' | 'foliage' | 'smoke' | 'npc'; objectId: string; seed: number }[];
}

export interface TownRendererSnapshot {
  mounted: boolean;
  paused: boolean;
  frames: number;
  renderCalls: number;
  geometries: number;
  textures: number;
  canvasWidth: number;
  canvasHeight: number;
  playerX: number;
  playerZ: number;
}

export interface TownRenderer {
  mount(): void;
  update(time: number, delta: number, movement: TownMovementInput): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  getPlayerPosition(): TownGroundPoint;
  setPlayerPosition(point: TownGroundPoint): void;
  setNavigationPath(points: TownGroundPoint[]): void;
  screenToGround(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): TownGroundPoint | null;
  pickFacility(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): TownFacilityKey | null;
  worldToScreen(point: TownGroundPoint, viewportWidth: number, viewportHeight: number): { x: number; y: number };
  snapshot(): TownRendererSnapshot;
}

export class TownRendererUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TownRendererUnsupportedError';
  }
}
