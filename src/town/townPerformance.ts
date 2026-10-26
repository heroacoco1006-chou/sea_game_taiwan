export interface TownFrameSummary {
  samples: number;
  medianFps: number;
  p95FrameMs: number;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

/** P6 共用效能摘要；保留最近一分鐘樣本，由瀏覽器診斷直接讀取。 */
export function summarizeTownFrameTimes(frameTimes: readonly number[]): TownFrameSummary {
  const sorted = frameTimes
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 1000)
    .slice(-3600)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return { samples: 0, medianFps: 0, p95FrameMs: 0 };
  const medianFrameMs = percentile(sorted, 0.5);
  return {
    samples: sorted.length,
    medianFps: Number((1000 / medianFrameMs).toFixed(1)),
    p95FrameMs: Number(percentile(sorted, 0.95).toFixed(2)),
  };
}
