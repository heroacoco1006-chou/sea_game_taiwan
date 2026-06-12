import Phaser from 'phaser';

/** 程式產生所有貼圖（正式美術於 M5 替換） */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeShipTexture();
    this.makePortTexture();
    this.makePlayerTexture();
    this.makeGoodsIcons();
    this.scene.start('Title');
  }

  private makeShipTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x6b4423, 1);
    g.fillEllipse(16, 22, 26, 10);
    g.fillStyle(0x8a5a30, 1);
    g.fillEllipse(16, 20, 22, 7);
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(15, 4, 2, 16);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(8, 5, 14, 12);
    g.lineStyle(1, 0xb09a6a, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(8, 8 + i * 3, 22, 8 + i * 3);
    g.generateTexture('ship', 32, 30);
    g.destroy();
  }

  private makePortTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xb8452e, 1);
    g.fillTriangle(2, 12, 12, 4, 22, 12);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(5, 12, 14, 10);
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(10, 16, 4, 6);
    g.generateTexture('port', 24, 24);
    g.destroy();
  }

  /** 港町裡的主角小人（16x24） */
  private makePlayerTexture(): void {
    const g = this.add.graphics();
    // 頭
    g.fillStyle(0xe8c8a0, 1);
    g.fillCircle(8, 6, 5);
    // 斗笠
    g.fillStyle(0xa8884a, 1);
    g.fillTriangle(1, 5, 8, -1, 15, 5);
    // 身體（藍衫）
    g.fillStyle(0x3a5a8a, 1);
    g.fillRect(3, 11, 10, 9);
    // 腿
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(4, 20, 3, 4);
    g.fillRect(9, 20, 3, 4);
    g.generateTexture('player', 16, 24);
    g.destroy();
  }

  /**
   * 貨物圖示：每類別一種剪影（20x20，畫成白色），遊戲中用 setTint 上各貨物專屬色。
   */
  private makeGoodsIcons(): void {
    const mk = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.lineStyle(2, 0xffffff, 1);
      draw(g);
      g.generateTexture(key, 20, 20);
      g.destroy();
    };
    // 絲織品：布捲
    mk('icon_silk', (g) => {
      g.fillRoundedRect(2, 6, 16, 9, 3);
      g.fillCircle(4, 10, 4.5);
      g.fillCircle(16, 10, 4.5);
    });
    // 瓷陶器：瓶子
    mk('icon_ceramic', (g) => {
      g.fillRect(8, 2, 4, 4);
      g.fillEllipse(10, 12, 12, 12);
    });
    // 香料：麻袋
    mk('icon_spice', (g) => {
      g.fillTriangle(10, 2, 4, 8, 16, 8);
      g.fillRoundedRect(3, 7, 14, 11, 4);
    });
    // 食品：木桶
    mk('icon_food', (g) => {
      g.fillRoundedRect(4, 3, 12, 15, 3);
      g.lineBetween(4, 8, 16, 8);
      g.lineBetween(4, 13, 16, 13);
    });
    // 原料：木箱
    mk('icon_material', (g) => {
      g.fillRect(3, 5, 14, 12);
      g.lineBetween(3, 11, 17, 11);
      g.lineBetween(10, 5, 10, 17);
    });
    // 貴重品：金錠
    mk('icon_treasure', (g) => {
      g.fillTriangle(10, 3, 2, 16, 18, 16);
      g.fillRect(2, 14, 16, 4);
    });
  }
}
