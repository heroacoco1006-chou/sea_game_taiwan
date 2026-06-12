import Phaser from 'phaser';
import { GameState, PORTS, Port, cargoCount, CARGO_MAX, saveGame, dateText } from '../state';
import { COLORS, textStyle } from '../ui';

/**
 * 走動式港町（仿大航海時代2）：
 * 主角在港內城市走動，走到設施門口按 Enter 才進入對談式選單。
 */

interface Building {
  key: string; // facility 類型：trade/tavern/inn/harbor/shipyard/office
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 各文化圈的建築配色（屋頂、牆面） */
const CULTURE_STYLE: Record<string, { roof: number; wall: number; ground: number }> = {
  han: { roof: 0x8a3024, wall: 0xd8c8a8, ground: 0xb8a070 },
  wa: { roof: 0x4a4a52, wall: 0xe8e0d0, ground: 0xc0b090 },
  euro: { roof: 0xa85a28, wall: 0xd8b89a, ground: 0xb09878 },
  ryu: { roof: 0xb84a30, wall: 0xe8d8b8, ground: 0xc0a878 },
  sea: { roof: 0x7a6a3a, wall: 0xc8a878, ground: 0xa89868 },
};

const PLAYER_SPEED = 220;

export default class PortScene extends Phaser.Scene {
  private port!: Port;
  private player!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key };
  private hint!: Phaser.GameObjects.Text;
  private buildings: Building[] = [];
  private spawn?: { x: number; y: number };

  constructor() {
    super('Port');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; spawn?: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.spawn = data.spawn;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const style = CULTURE_STYLE[this.port.culture] ?? CULTURE_STYLE.han;

    // 地面與碼頭
    this.add.rectangle(W / 2, H / 2, W, H, style.ground);
    const paths = this.add.graphics();
    paths.fillStyle(0x00000022 as unknown as number, 0.12);
    paths.fillRect(0, 300, W, 70); // 橫向街道
    paths.fillRect(W / 2 - 35, 90, 70, 570);
    this.add.rectangle(W / 2, H - 30, W, 60, COLORS.sea); // 港邊海面
    this.add.rectangle(W / 2, H - 64, 300, 16, 0x6b4a2a); // 棧橋
    this.add.image(W / 2 + 200, H - 30, 'ship').setScale(1.4);

    // 建築（依港口是否有造船廠調整）
    this.buildings = [
      { key: 'trade', label: '交易所', x: 240, y: 175, w: 220, h: 130 },
      { key: 'tavern', label: '酒館', x: 640, y: 175, w: 200, h: 130 },
      { key: 'inn', label: '旅館', x: 1040, y: 175, w: 200, h: 130 },
      { key: 'office', label: this.port.culture === 'han' ? '官府' : '商館', x: 240, y: 430, w: 200, h: 120 },
      { key: 'harbor', label: '港務局', x: 1040, y: 430, w: 200, h: 120 },
    ];
    if (this.port.shipyard) {
      this.buildings.push({ key: 'shipyard', label: '造船廠', x: 640, y: 430, w: 220, h: 120 });
    }

    const g = this.add.graphics();
    for (const b of this.buildings) {
      // 牆
      g.fillStyle(style.wall, 1);
      g.fillRect(b.x - b.w / 2, b.y - b.h / 2 + 18, b.w, b.h - 18);
      // 屋頂
      g.fillStyle(style.roof, 1);
      g.fillTriangle(b.x - b.w / 2 - 14, b.y - b.h / 2 + 22, b.x + b.w / 2 + 14, b.y - b.h / 2 + 22, b.x, b.y - b.h / 2 - 26);
      // 門
      g.fillStyle(0x4a2f15, 1);
      g.fillRect(b.x - 16, b.y + b.h / 2 - 36, 32, 36);
      // 招牌
      this.add
        .text(b.x, b.y - 4, b.label, { ...textStyle(20, '#fff8e8'), backgroundColor: '#3a2a14cc', padding: { x: 8, y: 3 } })
        .setOrigin(0.5);
    }

    // 主角
    const start = this.spawn ?? { x: W / 2, y: H - 110 };
    this.player = this.add.image(start.x, start.y, 'player').setDepth(10);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // 頂部資訊列
    this.add.rectangle(W / 2, 24, W, 48, 0x3a2a14, 0.92).setDepth(100);
    this.add
      .text(14, 12, `【${this.port.name}】${this.port.region}　　${dateText(this.state.day)}　資金 ${this.state.gold} 兩　貨艙 ${cargoCount(this.state)}/${CARGO_MAX}`, textStyle(18, '#f2e3bd'))
      .setDepth(101);
    this.hint = this.add
      .text(W / 2, H - 8, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5, 1).setDepth(101).setShadow(1, 1, '#000', 2);
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
      const nx = Phaser.Math.Clamp(this.player.x + (dx / len) * PLAYER_SPEED * dt, 16, this.scale.width - 16);
      const ny = Phaser.Math.Clamp(this.player.y + (dy / len) * PLAYER_SPEED * dt, 86, this.scale.height - 78);
      if (!this.hitsBuilding(nx, ny)) {
        this.player.setPosition(nx, ny);
      }
    }

    // 門口判定
    const door = this.nearDoor();
    const atDock = this.player.y > this.scale.height - 130 && Math.abs(this.player.x - this.scale.width / 2) < 170;

    if (door) {
      this.hint.setText(`按 Enter 進入【${door.label}】`);
    } else if (atDock) {
      this.hint.setText('按 Enter 出航');
    } else {
      this.hint.setText('方向鍵走動｜走到設施門口按 Enter 進入｜走到棧橋按 Enter 出航');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      if (door) {
        const ret = { x: door.x, y: door.y + door.h / 2 + 26 };
        if (door.key === 'trade') {
          this.scene.start('Trade', { portId: this.port.id, door: ret });
        } else {
          this.scene.start('Facility', { portId: this.port.id, type: door.key, door: ret });
        }
      } else if (atDock) {
        saveGame(this.state);
        this.scene.start('WorldMap');
      }
    }
  }

  private hitsBuilding(x: number, y: number): boolean {
    return this.buildings.some(
      (b) => x > b.x - b.w / 2 - 8 && x < b.x + b.w / 2 + 8 && y > b.y - b.h / 2 - 20 && y < b.y + b.h / 2 + 6
    );
  }

  private nearDoor(): Building | null {
    for (const b of this.buildings) {
      const doorX = b.x;
      const doorY = b.y + b.h / 2;
      if (Math.abs(this.player.x - doorX) < 36 && this.player.y > doorY - 6 && this.player.y < doorY + 46) {
        return b;
      }
    }
    return null;
  }
}
