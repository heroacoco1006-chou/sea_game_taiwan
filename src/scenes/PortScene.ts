import Phaser from 'phaser';
import { GameState, PORTS, Port, cargoCount, CARGO_MAX, saveGame } from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast } from '../ui';

export default class PortScene extends Phaser.Scene {
  private port!: Port;

  constructor() {
    super('Port');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x2b3a4a);

    // 港口天際線（簡易剪影，依港口換色調）
    const skyline = this.add.graphics();
    const tint = this.port.id === 'hirado' ? 0x4a3a52 : this.port.id === 'tayouan' ? 0x3a4a3a : 0x4a3a2a;
    skyline.fillStyle(tint, 1);
    for (let i = 0; i < 14; i++) {
      const bw = 60 + ((i * 37) % 50);
      const bh = 60 + ((i * 53) % 120);
      skyline.fillRect(i * 95, 250 - bh, bw, bh);
      skyline.fillTriangle(i * 95, 250 - bh, i * 95 + bw, 250 - bh, i * 95 + bw / 2, 250 - bh - 26);
    }
    this.add.rectangle(width / 2, 290, width, 80, 0x6b5a3a);

    // 標題面板
    drawPanel(this, 40, 30, 620, 150);
    this.add.text(70, 50, `${this.port.name}　`, textStyle(40)).setOrigin(0, 0);
    this.add.text(250, 68, `（${this.port.region}）`, textStyle(20, '#6b5530'));
    this.add
      .text(70, 110, this.port.desc, { ...textStyle(17, '#4a3a20'), wordWrap: { width: 560 } })
      .setOrigin(0, 0);

    // HUD
    const s = this.state;
    drawPanel(this, width - 330, 30, 290, 110);
    this.add.text(width - 305, 48, `第 ${s.day} 天`, textStyle(20));
    this.add.text(width - 305, 78, `資金 ${s.gold} 兩`, textStyle(20));
    this.add.text(width - 305, 108, `貨艙 ${cargoCount(s)}/${CARGO_MAX}`, textStyle(20));

    // 設施選單
    drawPanel(this, width / 2 - 220, 360, 440, 300);
    this.add.text(width / 2, 392, '— 港口設施 —', textStyle(22)).setOrigin(0.5);

    makeButton(this, width / 2, 445, 340, 54, '交易所（買賣貨物）', () => {
      this.scene.start('Trade', { portId: this.port.id });
    });

    makeButton(this, width / 2, 515, 340, 54, '旅館（休息一天並存檔）', () => {
      this.state.day += 1;
      saveGame(this.state);
      toast(this, '休息一晚，旅途的進度已寫進航海日誌（存檔完成）', width / 2, 330);
      this.time.delayedCall(50, () => this.refreshHud());
    });

    makeButton(this, width / 2, 585, 340, 54, '出航', () => {
      saveGame(this.state);
      this.scene.start('WorldMap');
    });
  }

  private refreshHud(): void {
    this.scene.restart({ portId: this.port.id });
  }
}
