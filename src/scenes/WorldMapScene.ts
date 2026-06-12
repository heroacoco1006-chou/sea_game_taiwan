import Phaser from 'phaser';
import { GameState, PORTS, Port, cargoCount, CARGO_MAX, saveGame } from '../state';
import { COLORS, textStyle, toast } from '../ui';

const SHIP_SPEED = 130; // px/s
const PX_PER_DAY = 160; // 每航行 160px 過一天
const PORT_RADIUS = 30; // 入港判定距離

// 風格化地形（多邊形頂點），僅示意海岸線，非精確地圖
const LANDS: number[][][] = [
  // 中國東南沿海
  [
    [0, 0], [250, 0], [230, 90], [280, 180], [250, 270], [290, 310],
    [250, 400], [300, 470], [260, 560], [300, 650], [270, 720], [0, 720],
  ],
  // 台灣
  [
    [585, 370], [620, 400], [635, 465], [620, 545], [580, 600],
    [550, 555], [540, 470], [555, 405],
  ],
  // 日本九州一帶
  [
    [940, 0], [1280, 0], [1280, 230], [1130, 250], [1020, 200], [960, 110],
  ],
  // 琉球小島（裝飾）
  [
    [790, 300], [815, 308], [810, 328], [785, 320],
  ],
];

export default class WorldMapScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key };
  private hud!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private distAcc = 0;
  private nearPort: Port | null = null;
  private landPolys: Phaser.Geom.Polygon[] = [];

  constructor() {
    super('WorldMap');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  create(): void {
    const { width, height } = this.scale;

    // 海
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.sea);
    const waves = this.add.graphics();
    waves.lineStyle(1, 0x2a6a8e, 0.6);
    for (let y = 40; y < height; y += 48) {
      for (let x = 20; x < width; x += 72) {
        waves.beginPath();
        waves.arc(x + ((y / 48) % 2) * 36, y, 10, Math.PI * 0.15, Math.PI * 0.85);
        waves.strokePath();
      }
    }

    // 陸地
    const landG = this.add.graphics();
    for (const pts of LANDS) {
      const flat = pts.flat();
      this.landPolys.push(new Phaser.Geom.Polygon(flat));
      landG.fillStyle(COLORS.land, 1);
      landG.lineStyle(3, COLORS.landEdge, 1);
      landG.beginPath();
      landG.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) landG.lineTo(pts[i][0], pts[i][1]);
      landG.closePath();
      landG.fillPath();
      landG.strokePath();
    }

    // 地名標示（教育：讓小朋友記住相對位置）
    this.add.text(70, 350, '明國\n（福建）', textStyle(18, '#6b5530')).setOrigin(0, 0.5);
    this.add.text(587, 480, '台灣', textStyle(18, '#6b5530')).setOrigin(0.5);
    this.add.text(1150, 90, '日本', textStyle(18, '#6b5530')).setOrigin(0.5);
    this.add.text(800, 290, '琉球', textStyle(13, '#cfe3ee')).setOrigin(0.5);

    // 港口
    for (const p of PORTS) {
      this.add.image(p.x, p.y, 'port');
      this.add.text(p.x, p.y + 22, p.name, textStyle(16, '#fff4d6')).setOrigin(0.5).setShadow(1, 1, '#000', 2);
    }

    // 船
    this.ship = this.add.image(this.state.ship.x, this.state.ship.y, 'ship');
    this.ship.setDepth(10);

    // 操作
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // HUD
    this.add.rectangle(width / 2, 22, width, 44, 0x3a2a14, 0.92).setDepth(100);
    this.hud = this.add.text(16, 10, '', textStyle(19, '#f2e3bd')).setDepth(101);
    this.hint = this.add
      .text(width / 2, height - 28, '方向鍵或 WASD 航行｜靠近港口按 Enter 入港', textStyle(17, '#fff4d6'))
      .setOrigin(0.5)
      .setDepth(101)
      .setShadow(1, 1, '#000', 2);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const nx = this.ship.x + (dx / len) * SHIP_SPEED * dt;
      const ny = this.ship.y + (dy / len) * SHIP_SPEED * dt;
      const cx = Phaser.Math.Clamp(nx, 10, this.scale.width - 10);
      const cy = Phaser.Math.Clamp(ny, 54, this.scale.height - 10);
      if (!this.isLand(cx, cy)) {
        const moved = Math.hypot(cx - this.ship.x, cy - this.ship.y);
        this.ship.setPosition(cx, cy);
        this.ship.setFlipX(dx < 0);
        this.state.ship.x = cx;
        this.state.ship.y = cy;
        this.distAcc += moved;
        if (this.distAcc >= PX_PER_DAY) {
          this.distAcc -= PX_PER_DAY;
          this.state.day += 1;
          this.updateHud();
        }
      }
    }

    // 入港判定
    this.nearPort = null;
    for (const p of PORTS) {
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, p.x, p.y) <= PORT_RADIUS) {
        this.nearPort = p;
        break;
      }
    }
    this.hint.setText(
      this.nearPort
        ? `按 Enter 進入【${this.nearPort.name}】`
        : '方向鍵或 WASD 航行｜靠近港口按 Enter 入港'
    );

    if (this.nearPort && Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      saveGame(this.state); // 入港自動快速存檔
      this.scene.start('Port', { portId: this.nearPort.id });
    }
  }

  private isLand(x: number, y: number): boolean {
    return this.landPolys.some((poly) => Phaser.Geom.Polygon.Contains(poly, x, y));
  }

  private updateHud(): void {
    const s = this.state;
    this.hud.setText(
      `第 ${s.day} 天　　資金 ${s.gold} 兩　　貨艙 ${cargoCount(s)}/${CARGO_MAX}`
    );
  }
}
