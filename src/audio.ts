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

// ---- 背景音樂（程式合成，簡單但各場景可辨識）----
export type BgmKey =
  | 'sailing' | 'battle' | 'adventure'
  | 'town_china' | 'town_taiwan' | 'town_japan' | 'town_seasia';

const SCALES = {
  majPenta: [0, 2, 4, 7, 9], // 大調五聲（中國／台灣／南洋）
  minor: [0, 2, 3, 5, 7, 8, 10], // 小調（海戰／冒險）
  hira: [0, 2, 3, 7, 8], // 日本平調子風
};

interface BgmSpec {
  tempo: number; // BPM（一拍＝一步）
  root: number; // 主音頻率
  scale: number[];
  wave: OscillatorType;
  bassWave: OscillatorType;
  melody: number[]; // 每步旋律音級（-99＝休止）
  bass: number[]; // 每步低音音級（-99＝休止；實際低八度）
}

// 用不同音階＋速度＋波形讓七種場景一聽就能分辨
const BGM: Record<BgmKey, BgmSpec> = {
  sailing: { tempo: 70, root: 261.63, scale: SCALES.majPenta, wave: 'triangle', bassWave: 'sine',
    melody: [0, 2, 4, 2, 7, 4, 2, 0], bass: [0, -99, -99, -99, 2, -99, -99, -99] },
  battle: { tempo: 140, root: 196.0, scale: SCALES.minor, wave: 'sawtooth', bassWave: 'sawtooth',
    melody: [0, 3, 0, 4, 3, 1, 4, 3], bass: [0, 0, 0, 0, 4, 4, 2, 2] },
  adventure: { tempo: 86, root: 261.63, scale: SCALES.minor, wave: 'sine', bassWave: 'triangle',
    melody: [0, -99, 3, -99, 5, -99, 4, 3], bass: [0, -99, -99, -99, 5, -99, -99, -99] },
  town_china: { tempo: 100, root: 293.66, scale: SCALES.majPenta, wave: 'square', bassWave: 'triangle',
    melody: [0, 2, 4, 5, 4, 2, 1, 0], bass: [0, -99, 4, -99, 2, -99, 4, -99] },
  town_taiwan: { tempo: 82, root: 196.0, scale: SCALES.majPenta, wave: 'triangle', bassWave: 'sine',
    melody: [4, 2, 0, 2, 4, 5, 4, 2], bass: [0, -99, -99, -99, 4, -99, -99, -99] },
  town_japan: { tempo: 74, root: 329.63, scale: SCALES.hira, wave: 'triangle', bassWave: 'sine',
    melody: [0, 2, 3, -99, 4, 3, 2, -99], bass: [0, -99, -99, -99, 2, -99, -99, -99] },
  town_seasia: { tempo: 112, root: 349.23, scale: SCALES.majPenta, wave: 'square', bassWave: 'triangle',
    melody: [0, 4, 2, 7, 5, 4, 2, 0], bass: [0, -99, -99, 2, -99, 4, -99, -99] },
};

/** 港口 region → 城町 BGM。 */
export function townBgmForRegion(region: string): BgmKey {
  if (region.includes('台灣') || region.includes('澎湖')) return 'town_taiwan';
  if (region.includes('中國')) return 'town_china';
  if (region.includes('日本') || region.includes('琉球')) return 'town_japan';
  return 'town_seasia';
}

/** 音級轉頻率（音級可超出音階長度＝跨八度；負值＝低八度） */
function degToFreq(root: number, scale: number[], deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const semis = scale[((deg % n) + n) % n] + 12 * oct;
  return root * Math.pow(2, semis / 12);
}

// 真實 BGM 音檔（CC-BY／CC0，放 assets/m5/audio/bgm/<key>.mp3|ogg）。
// 有對應檔案的 key 會用音檔播放（覆蓋程式合成）；沒有就退回上面的合成樂句。
const BGM_FILE_URLS: Record<string, string> = (() => {
  const g = import.meta.glob('/assets/m5/audio/bgm/*.{mp3,ogg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const p in g) {
    const base = p.split('/').pop()!.replace(/\.(mp3|ogg)$/i, '');
    out[base] = g[p];
  }
  return out;
})();

class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private noiseBuffer: AudioBuffer | null = null;
  // 背景音樂排程
  private bgmGain: GainNode | null = null;
  private bgmKey: BgmKey | null = null;
  private bgmSpec: BgmSpec | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private nextNoteTime = 0;
  private bgmSource: AudioBufferSourceNode | null = null; // 音檔播放中的來源節點
  private bgmBuffers: Record<string, AudioBuffer> = {};

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
    this.refreshBgmGain();
  }
  toggleMute(): boolean { this.settings.muted = !this.settings.muted; this.save(); this.refreshBgmGain(); return this.settings.muted; }
  setMuted(m: boolean): void { this.settings.muted = m; this.save(); this.refreshBgmGain(); }

  private sfxLevel(): number {
    if (this.settings.muted) return 0;
    return (this.settings.master / 100) * (this.settings.sfx / 100);
  }
  private bgmLevel(): number {
    if (this.settings.muted) return 0;
    return (this.settings.master / 100) * (this.settings.bgm / 100);
  }
  private refreshBgmGain(): void {
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmLevel(), this.ctx.currentTime, 0.05);
    }
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

  // ---- 背景音樂（有 CC-BY 音檔就播音檔，否則程式合成循環樂句）----
  playBgm(key: BgmKey): void {
    if (this.bgmKey === key && (this.bgmTimer !== null || this.bgmSource !== null)) return; // 同曲播放中
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.value = this.bgmLevel();
      this.bgmGain.connect(ctx.destination);
    } else {
      this.refreshBgmGain();
    }
    this.bgmKey = key;
    // 停掉前一首（兩種模式都停）
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    this.bgmSpec = null;
    this.stopBgmSource();

    if (BGM_FILE_URLS[key]) {
      void this.playBgmFile(key, BGM_FILE_URLS[key]); // 真實音檔
      return;
    }
    const spec = BGM[key];
    if (!spec) return;
    this.bgmSpec = spec; // 程式合成
    this.bgmStep = 0;
    this.nextNoteTime = ctx.currentTime;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 25);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    this.stopBgmSource();
    this.bgmKey = null;
    this.bgmSpec = null;
    if (this.bgmGain && this.ctx) this.bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  private stopBgmSource(): void {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch { /* 已停 */ }
      try { this.bgmSource.disconnect(); } catch { /* ignore */ }
      this.bgmSource = null;
    }
  }

  /** 播放循環音檔（fetch→decode→loop），decode 結果快取。 */
  private async playBgmFile(key: BgmKey, url: string): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    let buf = this.bgmBuffers[key];
    if (!buf) {
      try {
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        buf = await ctx.decodeAudioData(ab);
        this.bgmBuffers[key] = buf;
      } catch { return; }
    }
    if (this.bgmKey !== key) return; // 載入期間已切走
    this.stopBgmSource();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.bgmGain);
    src.start();
    this.bgmSource = src;
  }

  /** 排程器：用 lookahead 把循環樂句的音符排到 AudioContext 時間軸上。 */
  private scheduleBgm(): void {
    const ctx = this.ctx;
    const spec = this.bgmSpec;
    if (!ctx || !spec || !this.bgmGain) return;
    if (ctx.state !== 'running') { this.nextNoteTime = ctx.currentTime + 0.1; return; } // 等待解鎖
    const beat = 60 / spec.tempo;
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      const step = this.bgmStep % spec.melody.length;
      const t = this.nextNoteTime;
      const mDeg = spec.melody[step];
      if (mDeg !== -99) this.bgmTone(degToFreq(spec.root, spec.scale, mDeg), t, beat * 0.5, spec.wave, 0.12);
      const bDeg = spec.bass[step];
      if (bDeg !== -99) this.bgmTone(degToFreq(spec.root, spec.scale, bDeg) / 2, t, beat * 0.9, spec.bassWave, 0.16);
      this.bgmStep = (this.bgmStep + 1) % spec.melody.length;
      this.nextNoteTime += beat;
    }
  }

  private bgmTone(freq: number, t: number, dur: number, wave: OscillatorType, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const audio = new AudioManager();
