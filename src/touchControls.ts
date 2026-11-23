import Phaser from 'phaser';
import { audio } from './audio';
import { BASE_H, textStyle } from './ui';

type Direction = { x: number; y: number };
export type TouchControlMode = 'auto' | 'on' | 'off';

const TOUCH_MODE_KEY = 'seagame_touch_mode';

export function getTouchControlMode(): TouchControlMode {
  try {
    const raw = localStorage.getItem(TOUCH_MODE_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') return raw;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function setTouchControlMode(mode: TouchControlMode): void {
  try {
    localStorage.setItem(TOUCH_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function cycleTouchControlMode(): TouchControlMode {
  const cur = getTouchControlMode();
  const next: TouchControlMode = cur === 'auto' ? 'on' : cur === 'on' ? 'off' : 'auto';
  setTouchControlMode(next);
  return next;
}

export function prefersTouchControls(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const mode = getTouchControlMode();
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true) return true;
  const hasFinePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true;
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !hasFinePointer;
}

/**
 * 世界地圖與港町共用的行動觸控層。只提供輸入狀態，實際移動／互動仍由場景原有邏輯處理。
 */
export class TouchControls {
  readonly enabled: boolean;
  private held = new Map<number, Direction>();
  private directionZones: Phaser.GameObjects.Rectangle[] = [];
  private actionQueued = false;
  private actionText?: Phaser.GameObjects.Text;
  private actionZone?: Phaser.GameObjects.Rectangle;
  private directionAnchorZone?: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene, actionLabel = '動作') {
    this.enabled = prefersTouchControls();
    if (!this.enabled) return;

    this.directionAnchorZone = this.scene.add
      .rectangle(160, 560, 290, 270, 0x000000, 0)
      .setDepth(499)
      .setScrollFactor(0);

    this.createDirectionButton(70, 560, '◀', -1, 0);
    this.createDirectionButton(250, 560, '▶', 1, 0);
    this.createDirectionButton(160, 470, '▲', 0, -1);
    this.createDirectionButton(160, 650, '▼', 0, 1);
    this.createActionButton(900, 625, actionLabel);

    this.scene.input.on('pointerup', this.releasePointer, this);
    this.scene.input.on('pointerupoutside', this.releasePointer, this);
    this.scene.input.on('pointercancel', this.releaseAll, this);
    this.scene.events.on(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.releaseAll();
      this.scene.input.off('pointerup', this.releasePointer, this);
      this.scene.input.off('pointerupoutside', this.releasePointer, this);
      this.scene.input.off('pointercancel', this.releaseAll, this);
      this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    });
  }

  direction(): Direction {
    let x = 0;
    let y = 0;
    for (const dir of this.held.values()) {
      x += dir.x;
      y += dir.y;
    }
    return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
  }

  consumeAction(): boolean {
    const queued = this.actionQueued;
    this.actionQueued = false;
    return queued;
  }

  clearAction(): void {
    this.actionQueued = false;
  }

  directionAnchor(): Phaser.GameObjects.Rectangle | undefined {
    return this.directionAnchorZone;
  }

  actionAnchor(): Phaser.GameObjects.Rectangle | undefined {
    return this.actionZone;
  }

  setActionLabel(label: string, active = true): void {
    this.actionText?.setText(label);
    this.actionZone?.setAlpha(active ? 0.94 : 0.62);
  }

  private createDirectionButton(x: number, y: number, label: string, dx: number, dy: number): void {
    const zone = this.scene.add
      .rectangle(x, y, 94, 82, 0xf0e3bd, 0.88)
      .setStrokeStyle(4, 0x8a5e36, 0.96)
      .setDepth(500)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.scene.add
      .text(x, y, label, textStyle(30, '#3a2a14'))
      .setOrigin(0.5)
      .setDepth(501)
      .setScrollFactor(0);

    zone.on('pointerdown', (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.held.set(pointer.id, { x: dx, y: dy });
      zone.setFillStyle(0xffe49a, 0.98);
    });
    const release = (pointer: Phaser.Input.Pointer) => {
      this.held.delete(pointer.id);
      zone.setFillStyle(0xf0e3bd, 0.88);
    };
    zone.on('pointerup', release);
    zone.on('pointerout', release);
    zone.on('pointerupoutside', release);
    this.directionZones.push(zone);
  }

  private createActionButton(x: number, y: number, label: string): void {
    this.actionZone = this.scene.add
      .rectangle(x, y, 190, 92, 0xf0e3bd, 0.94)
      .setStrokeStyle(5, 0xc59a3d, 1)
      .setDepth(500)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.actionText = this.scene.add
      .text(x, y, label, { ...textStyle(22, '#3a2a14'), align: 'center', wordWrap: { width: 170 } })
      .setOrigin(0.5)
      .setDepth(501)
      .setScrollFactor(0);

    this.actionZone.on('pointerdown', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.actionQueued = true;
      this.actionZone?.setFillStyle(0xffe49a, 1);
      audio.playSfx('click');
    });
    this.actionZone.on('pointerup', () => this.actionZone?.setFillStyle(0xf0e3bd, 0.94));
    this.actionZone.on('pointerout', () => this.actionZone?.setFillStyle(0xf0e3bd, 0.94));

    this.scene.add
      .text(160, BASE_H - 18, '觸控方向', textStyle(13, '#fff4d6'))
      .setOrigin(0.5, 1)
      .setDepth(501)
      .setScrollFactor(0)
      .setShadow(1, 1, '#000', 2);
  }

  private releasePointer(pointer: Phaser.Input.Pointer): void {
    if (this.held.delete(pointer.id) && this.held.size === 0) {
      for (const zone of this.directionZones) zone.setFillStyle(0xf0e3bd, 0.88);
    }
  }

  private releaseAll(): void {
    this.held.clear();
    this.actionQueued = false;
    for (const zone of this.directionZones) zone.setFillStyle(0xf0e3bd, 0.88);
    this.actionZone?.setFillStyle(0xf0e3bd, 0.94);
  }
}
