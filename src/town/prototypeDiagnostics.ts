import type { TownRendererSnapshot } from './types';

export interface TownPrototypeDiagnosticsSnapshot {
  mounts: number;
  disposes: number;
  activeRenderers: number;
  lastRenderer: TownRendererSnapshot | null;
  lastError: string | null;
}

export class TownPrototypeDiagnostics {
  private mounts = 0;
  private disposes = 0;
  private lastRenderer: TownRendererSnapshot | null = null;
  private lastError: string | null = null;

  mounted(): void {
    this.mounts += 1;
    this.lastError = null;
  }

  disposed(): void {
    this.disposes += 1;
  }

  sampled(snapshot: TownRendererSnapshot): void {
    this.lastRenderer = { ...snapshot };
  }

  failed(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  snapshot(): TownPrototypeDiagnosticsSnapshot {
    return {
      mounts: this.mounts,
      disposes: this.disposes,
      activeRenderers: this.mounts - this.disposes,
      lastRenderer: this.lastRenderer ? { ...this.lastRenderer } : null,
      lastError: this.lastError,
    };
  }
}

export const townPrototypeDiagnostics = new TownPrototypeDiagnostics();
