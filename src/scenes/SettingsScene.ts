import Phaser from 'phaser';
import { COLORS, textStyle, drawPanel, makeButton } from '../ui';
import { audio } from '../audio';

type Track = 'master' | 'bgm' | 'sfx';

/**
 * 設定（音量／靜音／音樂版權）。
 * 以「覆蓋式」啟動：呼叫端 `this.scene.launch('Settings', { caller: this.scene.key })` 並
 * `this.scene.pause()`；本場景關閉時 resume 呼叫端、stop 自己，因此可從任何場景開啟並原樣返回。
 * 同時滿足 M5-5e（音量設定 UI）與 M5-5g（遊戲內 CC-BY 音樂標註）。
 */
export default class SettingsScene extends Phaser.Scene {
  private caller = 'Title';
  private muteBtn?: Phaser.GameObjects.Container;

  constructor() {
    super('Settings');
  }

  init(data: { caller?: string }): void {
    this.caller = data.caller ?? 'Title';
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // 半透明遮罩（同時攔截點擊，避免穿透到底下暫停中的場景）
    this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.55).setInteractive();

    const pw = 660;
    const ph = 540;
    const px = cx - pw / 2;
    const py = (H - ph) / 2;
    drawPanel(this, px, py, pw, ph);
    this.add.text(cx, py + 42, '設定', textStyle(30)).setOrigin(0.5);

    const s = audio.getSettings();
    this.makeSlider('主音量', 'master', s.master, py + 118);
    this.makeSlider('背景音樂', 'bgm', s.bgm, py + 188);
    this.makeSlider('音效', 'sfx', s.sfx, py + 258);

    // 靜音切換
    this.renderMute(cx, py + 330);

    // 音樂版權標註（CC BY 4.0）— M5-5g 合規必備
    this.add.text(cx, py + 392, '🎵 音樂版權標註（CC BY 4.0）', textStyle(16, '#6b5530')).setOrigin(0.5);
    this.add
      .text(cx, py + 422, 'Music: Kevin MacLeod (incompetech.com) — CC BY 4.0', textStyle(15))
      .setOrigin(0.5);
    this.add
      .text(cx, py + 446, 'Music: PeriTune (peritune.com) — CC BY 4.0', textStyle(15))
      .setOrigin(0.5);

    // 返回
    makeButton(this, cx, py + ph - 46, 200, 46, '返回', () => this.close());

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** 一條音量滑桿：拖曳把手或點選軌道即時調整，並同步寫入 audio 設定。 */
  private makeSlider(label: string, track: Track, initial: number, y: number): void {
    const tx0 = 560;
    const tw = 300;
    this.add.text(380, y, label, textStyle(18)).setOrigin(0, 0.5);
    this.add.rectangle(tx0, y, tw, 10, COLORS.parchmentDark).setOrigin(0, 0.5);
    const fill = this.add.rectangle(tx0, y, (initial / 100) * tw, 10, COLORS.gold).setOrigin(0, 0.5);
    const valueText = this.add.text(880, y, `${initial}`, textStyle(18)).setOrigin(0, 0.5);

    const zone = this.add
      .rectangle(tx0 + tw / 2, y, tw, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    const handle = this.add
      .rectangle(tx0 + (initial / 100) * tw, y, 22, 30, COLORS.wood)
      .setStrokeStyle(2, 0xf5ecd2)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(handle);

    const apply = (x: number, preview: boolean) => {
      const clamped = Phaser.Math.Clamp(x, tx0, tx0 + tw);
      const value = Math.round(((clamped - tx0) / tw) * 100);
      handle.x = tx0 + (value / 100) * tw;
      fill.width = (value / 100) * tw;
      valueText.setText(`${value}`);
      audio.setVolume(track, value);
      // 調音效音量時放一個點擊聲試聽
      if (preview && track === 'sfx') audio.playSfx('click');
    };

    handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => apply(dragX, false));
    handle.on('dragend', () => { if (track === 'sfx') audio.playSfx('click'); });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => apply(p.x, true));
  }

  private renderMute(cx: number, y: number): void {
    this.muteBtn?.destroy();
    const muted = audio.getSettings().muted;
    this.muteBtn = makeButton(
      this,
      cx,
      y,
      260,
      46,
      muted ? '🔇 已靜音（點此開啟聲音）' : '🔊 聲音開啟（點此靜音）',
      () => {
        audio.toggleMute();
        this.renderMute(cx, y);
      },
      17
    );
  }

  private close(): void {
    this.scene.resume(this.caller);
    this.scene.stop();
  }
}
