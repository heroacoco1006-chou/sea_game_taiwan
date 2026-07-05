import Phaser from 'phaser';
import { hasAnySave, HEROES } from '../state';
import type { HeroId } from '../state';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, drawPanel } from '../ui';
import { audio } from '../audio';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const width = BASE_W;
    const height = BASE_H;
    audio.playBgm('sailing');

    // 入口背景：夕陽港灣精緻圖（1672×941＝16:9，剛好滿版不變形）；缺圖時退回海色＋波紋。
    if (this.textures.exists('title_bg')) {
      this.add.image(width / 2, height / 2, 'title_bg').setDisplaySize(width, height).setDepth(-10);
      // 輕度壓暗，確保上方標題面板、按鈕與底部文字清楚易讀
      this.add.rectangle(width / 2, height / 2, width, height, 0x140c06, 0.22).setDepth(-9);
    } else {
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

    // 設定／音量（右上角）
    makeButton(this, width - 95, 40, 150, 40, '設定／音量', () => {
      this.scene.launch('Settings', { caller: 'Title' });
      this.scene.pause();
    }, 16);


    // 音樂版權標註（CC BY 4.0）— 詳細兩行於「設定」頁
    this.add
      .text(
        width / 2,
        700,
        '音樂 Music: Kevin MacLeod (incompetech.com)・PeriTune (peritune.com)・CC BY 4.0',
        textStyle(13, '#7fa0b2')
      )
      .setOrigin(0.5);
  }
}
