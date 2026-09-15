export interface TownMovementInput {
  x: number;
  y: number;
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
  snapshot(): TownRendererSnapshot;
}

export class TownRendererUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TownRendererUnsupportedError';
  }
}
