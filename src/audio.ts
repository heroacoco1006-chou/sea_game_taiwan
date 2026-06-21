// 遊戲音訊管理（M5-5）。
// - 音效：用 Web Audio 即時合成（零外部檔、零版權）。
// - 背景音樂：留 playBgm/stopBgm 介面，音檔載入與切換於 M5-5c 補上。
// - 音量：master／bgm／sfx 三軌＋靜音，存 localStorage；首次使用者互動後解鎖 AudioContext。

export type SfxName =
  | 'click' | 'confirm' | 'cancel' | 'page'
  | 'coin' | 'cannon' | 'board' | 'victory' | 'defeat'
  | 'levelup' | 'unlock' | 'port';

export interface AudioSettings {
  master: number; // 0~100
  bgm: number;
  sfx: number;
  muted: boolean;
}

const STORE_KEY = 'seagame_audio';
const DEFAULTS: AudioSettings = { master: 80, bgm: 60, sfx: 80, muted: false };

interface ToneSpec {
  freq: number;
  type: OscillatorType;
  t: number; // 起始偏移秒
  dur: number;
  vol: number; // 0~1（再乘上音量設定）
}
interface NoiseSpec {
  t: number;
  dur: number;
  vol: number;
  cutoff: number; // 低通頻率
}
interface SfxSpec { tones?: ToneSpec[]; noises?: NoiseSpec[]; }

/** 各音效的合成配方（純波形＋包絡，給國小生用、不刺耳） */
const SFX: Record<SfxName, SfxSpec> = {
  click: { tones: [{ freq: 620, type: 'triangle', t: 0, dur: 0.07, vol: 0.18 }] },
  confirm: { tones: [{ freq: 660, type: 'triangle', t: 0, dur: 0.07, vol: 0.18 }, { freq: 990, type: 'triangle', t: 0.07, dur: 0.09, vol: 0.18 }] },
  cancel: { tones: [{ freq: 440, type: 'triangle', t: 0, dur: 0.08, vol: 0.16 }, { freq: 300, type: 'triangle', t: 0.07, dur: 0.1, vol: 0.16 }] },
  page: { noises: [{ t: 0, dur: 0.045, vol: 0.12, cutoff: 3000 }] },
  coin: { tones: [{ freq: 880, type: 'square', t: 0, dur: 0.06, vol: 0.16 }, { freq: 1320, type: 'square', t: 0.06, dur: 0.12, vol: 0.16 }] },
  cannon: {
    tones: [{ freq: 80, type: 'sine', t: 0, dur: 0.28, vol: 0.5 }],
    noises: [{ t: 0, dur: 0.3, vol: 0.5, cutoff: 700 }],
  },
  board: {
    tones: [{ freq: 160, type: 'square', t: 0, dur: 0.12, vol: 0.3 }],
    noises: [{ t: 0, dur: 0.14, vol: 0.3, cutoff: 1500 }],
  },
  victory: { tones: [
    { freq: 523, type: 'triangle', t: 0, dur: 0.14, vol: 0.22 },
    { freq: 659, type: 'triangle', t: 0.13, dur: 0.14, vol: 0.22 },
    { freq: 784, type: 'triangle', t: 0.26, dur: 0.14, vol: 0.22 },
    { freq: 1047, type: 'triangle', t: 0.39, dur: 0.26, vol: 0.24 },
  ] },
  defeat: { tones: [
    { freq: 392, type: 'sawtooth', t: 0, dur: 0.16, vol: 0.18 },
    { freq: 294, type: 'sawtooth', t: 0.15, dur: 0.16, vol: 0.18 },
    { freq: 196, type: 'sawtooth', t: 0.3, dur: 0.3, vol: 0.18 },
  ] },
  levelup: { tones: [
    { freq: 659, type: 'square', t: 0, dur: 0.1, vol: 0.18 },
    { freq: 880, type: 'square', t: 0.1, dur: 0.1, vol: 0.18 },
    { freq: 1175, type: 'square', t: 0.2, dur: 0.22, vol: 0.2 },
  ] },
  unlock: { tones: [
    { freq: 1047, type: 'sine', t: 0, dur: 0.14, vol: 0.2 },
    { freq: 1568, type: 'sine', t: 0.12, dur: 0.24, vol: 0.2 },
  ] },
  port: { tones: [
    { freq: 523, type: 'sine', t: 0, dur: 0.16, vol: 0.18 },
    { freq: 392, type: 'sine', t: 0.16, dur: 0.22, vol: 0.18 },
  ] },
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.settings = this.load();
  }

  private load(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  }
  private save(): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctor) this.ctx = new Ctor();
      } catch { this.ctx = null; }
    }
    return this.ctx;
  }

  /** 首次使用者互動時呼叫，解鎖瀏覽器音訊（自動播放限制）。 */
  unlock(): void {
    const ctx = this.ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  getSettings(): AudioSettings { return { ...this.settings }; }
  setVolume(track: 'master' | 'bgm' | 'sfx', value: number): void {
    this.settings[track] = Math.max(0, Math.min(100, Math.round(value)));
    this.save();
  }
  toggleMute(): boolean { this.settings.muted = !this.settings.muted; this.save(); return this.settings.muted; }
  setMuted(m: boolean): void { this.settings.muted = m; this.save(); }

  private sfxLevel(): number {
    if (this.settings.muted) return 0;
    return (this.settings.master / 100) * (this.settings.sfx / 100);
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /** 播放一個合成音效。 */
  playSfx(name: SfxName): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const level = this.sfxLevel();
    if (level <= 0) return;
    const spec = SFX[name];
    if (!spec) return;
    const now = ctx.currentTime + 0.001;

    for (const tn of spec.tones ?? []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tn.type;
      osc.frequency.setValueAtTime(tn.freq, now + tn.t);
      const peak = tn.vol * level;
      gain.gain.setValueAtTime(0.0001, now + tn.t);
      gain.gain.linearRampToValueAtTime(peak, now + tn.t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tn.t + tn.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + tn.t);
      osc.stop(now + tn.t + tn.dur + 0.02);
    }
    for (const ns of spec.noises ?? []) {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(ns.cutoff, now + ns.t);
      const gain = ctx.createGain();
      const peak = ns.vol * level;
      gain.gain.setValueAtTime(peak, now + ns.t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + ns.t + ns.dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now + ns.t);
      src.stop(now + ns.t + ns.dur + 0.02);
    }
  }

  // ---- 背景音樂（介面預留，M5-5c 實作載入與切換）----
  playBgm(_key: string): void { /* TODO M5-5c */ }
  stopBgm(): void { /* TODO M5-5c */ }
}

export const audio = new AudioManager();
