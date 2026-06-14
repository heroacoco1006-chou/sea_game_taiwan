import Phaser from 'phaser';
import { hasAnySave, HEROES } from '../state';
import type { HeroId } from '../state';
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

    this.add.text(width / 2, 350, '選擇主角開始新遊戲', textStyle(18, '#f2e3bd')).setOrigin(0.5);
    HEROES.forEach((hero, i) => {
      makeButton(
        this,
        width / 2,
        400 + i * 58,
        520,
        48,
        `${hero.name}（${hero.startYear}・${hero.role}）`,
        () => {
          // 選好主角後，挑一格存檔位置再開始（10 格可自由選擇）
          this.scene.start('SaveSlot', { mode: 'new', heroId: hero.id as HeroId, ret: { scene: 'Title' } });
        },
        17
      );
    });

    const canLoad = hasAnySave();
    const loadBtn = makeButton(this, width / 2, 590, 260, 50, '繼續航行（讀取）', () => {
      this.scene.start('SaveSlot', { mode: 'load', ret: { scene: 'Title' } });
    });
    if (!canLoad) loadBtn.setAlpha(0.45).disableInteractive();

    this.add
      .text(width / 2, 655, 'M4 — 三主角主線骨架・事件圖鑑・自由航海', textStyle(16, '#9ab8c8'))
      .setOrigin(0.5);
  }
}
