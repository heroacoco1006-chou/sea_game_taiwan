import Phaser from 'phaser';
import type { GameState } from './state';
import { saveGame } from './state';
import {
  activeTutorialModule,
  currentTutorialStep,
  handleTutorialEvent,
  tutorialResumeStep,
  skipTutorialModule,
  type TutorialStepDef,
} from './tutorial';
import { prefersTouchControls } from './touchControls';
import { BASE_W, BASE_H, COLORS, drawPanel, makeButton, textStyle } from './ui';

type AnchorObject = Phaser.GameObjects.GameObject & {
  getBounds?: () => Phaser.Geom.Rectangle;
  scrollFactorX?: number;
  scrollFactorY?: number;
};

export class TutorialOverlay {
  private readonly anchors = new Map<string, AnchorObject>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private outline?: Phaser.GameObjects.Graphics;
  private destroyed = false;
  private keyboardWasEnabled?: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.scale.on('resize', this.redrawAnchor, this);
    this.refresh();
  }

  registerAnchor(name: string, object: AnchorObject | undefined): void {
    if (!object) return;
    this.anchors.set(name, object);
    this.redrawAnchor();
  }

  emit(event: string, payload?: Record<string, unknown>): boolean {
    const result = handleTutorialEvent(this.state, event, payload);
    if (!result.changed) return false;
    saveGame(this.state);
    this.refresh();
    return true;
  }

  refresh(): void {
    if (this.destroyed) return;
    this.clear();
    const step = this.visibleStep();
    if (!step) return;
    if (step.presentation === 'modal') this.showModalStep(step);
    else this.showActionStep(step);
  }

  private visibleStep(): TutorialStepDef | null {
    return currentTutorialStep(this.state, this.scene.scene.key)
      ?? tutorialResumeStep(this.state, this.scene.scene.key);
  }

  private instruction(step: TutorialStepDef): string {
    return prefersTouchControls() ? step.body.touch : step.body.desktop;
  }

  private showModalStep(step: TutorialStepDef): void {
    if (this.scene.input.keyboard) {
      this.keyboardWasEnabled = this.scene.input.keyboard.enabled;
      this.scene.input.keyboard.enabled = false;
    }
    const cx = BASE_W / 2;
    const cy = BASE_H / 2;
    const w = 780;
    const h = 300;

    const dim = this.scene.add
      .rectangle(cx, cy, BASE_W, BASE_H, 0x000000, 0.58)
      .setDepth(900)
      .setScrollFactor(0)
      .setInteractive();
    const panel = drawPanel(this.scene, cx - w / 2, cy - h / 2, w, h)
      .setDepth(901)
      .setScrollFactor(0);
    const title = this.scene.add
      .text(cx, cy - 92, step.title, textStyle(28))
      .setOrigin(0.5)
      .setDepth(902)
      .setScrollFactor(0);
    const body = this.scene.add
      .text(cx, cy - 28, this.instruction(step), {
        ...textStyle(19, '#5a4a30'),
        align: 'center',
        wordWrap: { width: w - 100 },
        lineSpacing: 7,
      })
      .setOrigin(0.5)
      .setDepth(902)
      .setScrollFactor(0);

    const isWelcome = step.id === 'core_welcome';
    const continueButton = makeButton(
      this.scene,
      isWelcome ? cx - 145 : cx,
      cy + 92,
      240,
      50,
      isWelcome ? '開始簡短教學' : '知道了，繼續',
      () => this.emit(isWelcome ? 'tutorial_start' : 'tutorial_continue'),
      17,
    ).setDepth(903).setScrollFactor(0);

    this.objects.push(dim, panel, title, body, continueButton);

    if (step.canSkip) {
      const module = activeTutorialModule(this.state);
      if (module) {
        const skip = makeButton(
          this.scene,
          isWelcome ? cx + 145 : cx + 270,
          isWelcome ? cy + 92 : cy + 128,
          isWelcome ? 240 : 190,
          isWelcome ? 50 : 40,
          isWelcome ? '直接自由航行' : (module.id === 'core' ? '跳過核心教學' : '稍後再學'),
          () => this.skip(module.id),
          isWelcome ? 17 : 14,
        ).setDepth(903).setScrollFactor(0);
        this.objects.push(skip);
      }
    }
  }

  private showActionStep(step: TutorialStepDef): void {
    const cx = BASE_W / 2;
    const y = 120;
    const w = 760;
    const h = 112;
    const panel = drawPanel(this.scene, cx - w / 2, y - h / 2, w, h)
      .setDepth(880)
      .setScrollFactor(0);
    const title = this.scene.add
      .text(cx - 330, y - 30, step.title, textStyle(21))
      .setOrigin(0, 0.5)
      .setDepth(881)
      .setScrollFactor(0);
    const body = this.scene.add
      .text(cx - 330, y + 16, this.instruction(step), {
        ...textStyle(16, '#5a4a30'),
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0.5)
      .setDepth(881)
      .setScrollFactor(0);
    this.objects.push(panel, title, body);

    if (step.canSkip) {
      const module = activeTutorialModule(this.state);
      if (module) {
        const skipLabel = module.id === 'core' ? '跳過核心教學' : '稍後再學'
        const skip = makeButton(this.scene, cx + 305, y + 16, 140, 38, skipLabel, () => this.skip(module.id), 13)
          .setDepth(882)
          .setScrollFactor(0);
        this.objects.push(skip);
      }
    }
    this.redrawAnchor();
  }

  private skip(moduleId: string): void {
    if (!skipTutorialModule(this.state, moduleId)) return;
    saveGame(this.state);
    this.refresh();
  }

  private redrawAnchor(): void {
    this.outline?.destroy();
    this.outline = undefined;
    const step = this.visibleStep();
    if (!step || step.presentation !== 'action') return;
    const anchorId = prefersTouchControls() ? step.anchor?.touch : step.anchor?.desktop;
    if (!anchorId) return;
    const target = this.anchors.get(anchorId);
    const bounds = target?.getBounds?.();
    if (!target || !bounds) return;

    const cam = this.scene.cameras.main;
    const fixed = target.scrollFactorX === 0 && target.scrollFactorY === 0;
    const x = fixed ? bounds.x : bounds.x - cam.scrollX;
    const y = fixed ? bounds.y : bounds.y - cam.scrollY;
    const pad = 8;
    this.outline = this.scene.add.graphics().setDepth(879).setScrollFactor(0);
    this.outline.lineStyle(5, COLORS.gold, 1);
    this.outline.strokeRoundedRect(x - pad, y - pad, bounds.width + pad * 2, bounds.height + pad * 2, 12);
    this.outline.lineStyle(2, 0xfff3c8, 0.8);
    this.outline.strokeRoundedRect(x - pad - 4, y - pad - 4, bounds.width + pad * 2 + 8, bounds.height + pad * 2 + 8, 14);
  }

  private clear(): void {
    if (this.keyboardWasEnabled !== undefined && this.scene.input.keyboard) {
      this.scene.input.keyboard.enabled = this.keyboardWasEnabled;
      this.keyboardWasEnabled = undefined;
    }
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.outline?.destroy();
    this.outline = undefined;
  }

  destroy(): void {
    if (this.destroyed) return;
    const active = activeTutorialModule(this.state);
    if (active?.kind === 'context' && this.state.tutorial.activeContextModuleId === active.id) {
      this.state.tutorial.activeContextModuleId = null;
      saveGame(this.state);
    }
    this.destroyed = true;
    this.clear();
    this.scene.scale.off('resize', this.redrawAnchor, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }
}
