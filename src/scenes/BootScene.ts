import Phaser from 'phaser';

/** 程式產生所有 M1 需要的貼圖（之後里程碑再換正式素材） */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeShipTexture();
    this.makePortTexture();
    this.scene.start('Title');
  }

  private makeShipTexture(): void {
    const g = this.add.graphics();
    // 船身（戎克船：棕色船身＋米色硬帆）
    g.fillStyle(0x6b4423, 1);
    g.fillEllipse(16, 22, 26, 10);
    g.fillStyle(0x8a5a30, 1);
    g.fillEllipse(16, 20, 22, 7);
    // 桅杆
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(15, 4, 2, 16);
    // 硬帆（戎克船特徵：分節帆）
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(8, 5, 14, 12);
    g.lineStyle(1, 0xb09a6a, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(8, 8 + i * 3, 22, 8 + i * 3);
    g.generateTexture('ship', 32, 30);
    g.destroy();
  }

  private makePortTexture(): void {
    const g = this.add.graphics();
    // 港口標記：紅瓦小屋＋旗幟
    g.fillStyle(0xb8452e, 1);
    g.fillTriangle(2, 12, 12, 4, 22, 12);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(5, 12, 14, 10);
    g.fillStyle(0x4a2f15, 1);
    g.fillRect(10, 16, 4, 6);
    g.generateTexture('port', 24, 24);
    g.destroy();
  }
}
