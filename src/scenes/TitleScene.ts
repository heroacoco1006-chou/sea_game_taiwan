import Phaser from 'phaser';
import { newGame, loadGame, hasSave } from '../state';
import { COLORS, textStyle, makeButton, drawPanel } from '../ui';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    // 海色背景＋裝飾波紋
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.seaDeep);
    const g = this.add.graphics();
    g.lineStyle(2, 0x2a6a8e, 0.5);
    for (let y = 80; y < height; y += 60) {
      for (let x = 30; x < width; x += 90) {
        g.beginPath();
        g.arc(x + ((y / 60) % 2) * 45, y, 14, Math.PI * 0.15, Math.PI * 0.85);
        g.strokePath();
      }
    }

    drawPanel(this, width / 2 - 330, 120, 660, 200);
    this.add.text(width / 2, 195, '大航海福爾摩沙', textStyle(56)).setOrigin(0.5);
    this.add
      .text(width / 2, 265, '— 台灣大航海時代 1600～1662 —', textStyle(22, '#6b5530'))
      .setOrigin(0.5);

    makeButton(this, width / 2, 420, 260, 56, '新 遊 戲', () => {
      this.registry.set('state', newGame());
      this.scene.start('WorldMap');
    });

    const canLoad = hasSave();
    const loadBtn = makeButton(this, width / 2, 495, 260, 56, '繼續航行（讀取）', () => {
      const s = loadGame();
      if (s) {
        this.registry.set('state', s);
        this.scene.start('WorldMap');
      }
    });
    if (!canLoad) loadBtn.setAlpha(0.45).disableInteractive();

    this.add
      .text(width / 2, 600, 'M1 核心原型 — 月港・大員・平戶 三港貿易', textStyle(16, '#9ab8c8'))
      .setOrigin(0.5);
  }
}
