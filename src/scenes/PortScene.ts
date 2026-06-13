import Phaser from 'phaser';
import { GameState, PORTS, Port, cargoCount, CARGO_MAX, saveGame, dateText } from '../state';
import { COLORS, textStyle } from '../ui';

/**
 * 走動式港町（仿大航海時代2）：
 * 城比畫面大（鏡頭跟著主角捲動），鍵盤或滑鼠點擊移動，
 * 走到設施門口按 Enter（或點擊建築自動走過去）進入。
 */

interface Building {
  key: string; // trade/tavern/inn/harbor/shipyard/office
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const CULTURE_STYLE: Record<string, { roof: number; wall: number; ground: number }> = {
  han: { roof: 0x8a3024, wall: 0xd8c8a8, ground: 0xb8a070 },
  wa: { roof: 0x4a4a52, wall: 0xe8e0d0, ground: 0xc0b090 },
  euro: { roof: 0xa85a28, wall: 0xd8b89a, ground: 0xb09878 },
  ryu: { roof: 0xb84a30, wall: 0xe8d8b8, ground: 0xc0a878 },
  sea: { roof: 0x7a6a3a, wall: 0xc8a878, ground: 0xa89868 },
};

const PLAYER_SPEED = 230;
const TOWN_W = 2000;
const TOWN_H = 1100;
const MINI_W = 180;
const MINI_H = 100;

export default class PortScene extends Phaser.Scene {
  private port!: Port;
  private player!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key };
  private hint!: Phaser.GameObjects.Text;
  private buildings: Building[] = [];
  private spawn?: { x: number; y: number };
  private moveTarget: { x: number; y: number } | null = null;
  private autoEnterKey: string | null = null;
  private miniPlayer!: Phaser.GameObjects.Rectangle;
  private dock = { x: TOWN_W / 2, y: TOWN_H - 90 };

  constructor() {
    super('Port');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; spawn?: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.spawn = data.spawn;
    this.moveTarget = null;
    this.autoEnterKey = null;
  }

  create(): void {
    const style = CULTURE_STYLE[this.port.culture] ?? CULTURE_STYLE.han;

    // 地面
    this.add.rectangle(TOWN_W / 2, TOWN_H / 2, TOWN_W, TOWN_H, style.ground);
    const paths = this.add.graphics();
    paths.fillStyle(0x000000, 0.1);
    paths.fillRect(0, 430, TOWN_W, 80); // 大街（橫）
    paths.fillRect(TOWN_W / 2 - 40, 100, 80, TOWN_H - 200); // 大街（縱）

    // 港邊海面與棧橋
    this.add.rectangle(TOWN_W / 2, TOWN_H - 35, TOWN_W, 70, COLORS.sea);
    this.add.rectangle(this.dock.x, TOWN_H - 75, 340, 18, 0x6b4a2a);
    this.add.image(this.dock.x + 230, TOWN_H - 38, 'ship').setScale(1.5);

    // 設施建築（分散配置，需走動探索）
    this.buildings = [
      { key: 'trade', label: '交易所', x: 380, y: 300, w: 230, h: 140 },
      { key: 'tavern', label: '酒館', x: 950, y: 250, w: 200, h: 130 },
      { key: 'inn', label: '旅館', x: 1550, y: 300, w: 210, h: 135 },
      { key: 'office', label: this.port.culture === 'han' ? '官府' : '商館', x: 420, y: 700, w: 210, h: 125 },
      { key: 'harbor', label: '港務局', x: 1580, y: 700, w: 200, h: 120 },
    ];
    if (this.port.shipyard) {
      this.buildings.push({ key: 'shipyard', label: '造船廠', x: 1000, y: 720, w: 240, h: 130 });
    }

    const g = this.add.graphics();
    for (const b of this.buildings) {
      g.fillStyle(style.wall, 1);
      g.fillRect(b.x - b.w / 2, b.y - b.h / 2 + 18, b.w, b.h - 18);
      g.fillStyle(style.roof, 1);
      g.fillTriangle(b.x - b.w / 2 - 14, b.y - b.h / 2 + 22, b.x + b.w / 2 + 14, b.y - b.h / 2 + 22, b.x, b.y - b.h / 2 - 26);
      g.fillStyle(0x4a2f15, 1);
      g.fillRect(b.x - 16, b.y + b.h / 2 - 36, 32, 36);
      this.add
        .text(b.x, b.y - 4, b.label, { ...textStyle(20, '#fff8e8'), backgroundColor: '#3a2a14cc', padding: { x: 8, y: 3 } })
        .setOrigin(0.5);
    }

    // 裝飾：民宅、樹、水井、貨箱（豐富城景）
    this.addDecorations(style);

    // 主角與鏡頭
    const start = this.spawn ?? { x: this.dock.x, y: TOWN_H - 130 };
    this.player = this.add.image(start.x, start.y, 'player').setDepth(10);
    this.cameras.main.setBounds(0, 0, TOWN_W, TOWN_H);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,ENTER') as typeof this.keys;

    // 滑鼠點擊移動：點建築→走到門口自動進入；點地面→走過去
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX;
      const wy = p.worldY;
      const hit = this.buildings.find(
        (b) => wx > b.x - b.w / 2 && wx < b.x + b.w / 2 && wy > b.y - b.h / 2 - 26 && wy < b.y + b.h / 2
      );
      if (hit) {
        this.moveTarget = { x: hit.x, y: hit.y + hit.h / 2 + 22 };
        this.autoEnterKey = hit.key;
      } else {
        this.moveTarget = {
          x: Phaser.Math.Clamp(wx, 16, TOWN_W - 16),
          y: Phaser.Math.Clamp(wy, 96, TOWN_H - 86),
        };
        this.autoEnterKey = null;
      }
    });

    // 頂部資訊列（固定）
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, 24, W, 48, 0x3a2a14, 0.92).setDepth(100).setScrollFactor(0);
    this.add
      .text(14, 12, `【${this.port.name}】${this.port.region}　　${dateText(this.state.day)}　資金 ${this.state.gold} 兩　貨艙 ${cargoCount(this.state)}/${CARGO_MAX}　水手 ${this.state.crew} 人　疲勞 ${this.state.fatigue}`, textStyle(17, '#f2e3bd'))
      .setDepth(101).setScrollFactor(0);
    this.hint = this.add
      .text(W / 2, H - 8, '', textStyle(16, '#fff4d6'))
      .setOrigin(0.5, 1).setDepth(101).setScrollFactor(0).setShadow(1, 1, '#000', 2);

    this.createMinimap();
  }

  private addDecorations(style: { roof: number; wall: number }): void {
    const g = this.add.graphics();
    // 民宅（不可進入的小屋）
    const houses = [
      [180, 520], [700, 180], [1250, 200], [1850, 480], [200, 900], [750, 950], [1300, 940], [1850, 900],
    ];
    for (const [hx, hy] of houses) {
      g.fillStyle(style.wall, 0.85);
      g.fillRect(hx - 45, hy - 25, 90, 55);
      g.fillStyle(style.roof, 0.85);
      g.fillTriangle(hx - 55, hy - 22, hx + 55, hy - 22, hx, hy - 58);
    }
    // 樹
    const trees = [[120, 240], [620, 560], [1180, 540], [1750, 200], [1950, 620], [80, 760], [880, 480], [1420, 480]];
    for (const [tx, ty] of trees) {
      g.fillStyle(0x5a4530, 1);
      g.fillRect(tx - 4, ty, 8, 18);
      g.fillStyle(0x4a7a3a, 1);
      g.fillCircle(tx, ty - 12, 22);
    }
    // 水井（城中心）
    g.fillStyle(0x7a7a7a, 1);
    g.fillCircle(TOWN_W / 2, 470, 18);
    g.fillStyle(0x3a5a7a, 1);
    g.fillCircle(TOWN_W / 2, 470, 11);
    // 碼頭貨箱
    g.fillStyle(0x8a6a40, 1);
    for (const [cx, cy] of [[820, 990], [860, 975], [1160, 985]]) {
      g.fillRect(cx, cy, 30, 26);
    }
  }

  private createMinimap(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const mx = W - MINI_W - 14;
    const my = H - MINI_H - 14;
    const sx = MINI_W / TOWN_W;
    const sy = MINI_H / TOWN_H;
    const g = this.add.graphics().setDepth(100).setScrollFactor(0);
    g.fillStyle(COLORS.wood, 0.95);
    g.fillRoundedRect(mx - 5, my - 5, MINI_W + 10, MINI_H + 10, 6);
    g.fillStyle(0x9a8a60, 1);
    g.fillRect(mx, my, MINI_W, MINI_H);
    g.fillStyle(COLORS.sea, 1);
    g.fillRect(mx, my + MINI_H - 70 * sy, MINI_W, 70 * sy);
    // 建築點＋縮寫
    for (const b of this.buildings) {
      g.fillStyle(0x8a3024, 1);
      g.fillRect(mx + b.x * sx - 3, my + b.y * sy - 3, 6, 6);
      this.add
        .text(mx + b.x * sx, my + b.y * sy - 7, b.label[0], textStyle(10, '#fff8e8'))
        .setOrigin(0.5, 1).setDepth(101).setScrollFactor(0);
    }
    this.miniPlayer = this.add
      .rectangle(mx + this.player.x * sx, my + this.player.y * sy, 5, 5, 0xffffff)
      .setDepth(101).setScrollFactor(0);
    this.registry.set('townMini', { mx, my, sx, sy });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;

    // 鍵盤優先；按了方向鍵就取消滑鼠目標
    if (dx !== 0 || dy !== 0) {
      this.moveTarget = null;
      this.autoEnterKey = null;
      this.movePlayer(dx, dy, dt);
    } else if (this.moveTarget) {
      const tx = this.moveTarget.x - this.player.x;
      const ty = this.moveTarget.y - this.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 6) {
        this.moveTarget = null;
        if (this.autoEnterKey) {
          const b = this.buildings.find((x) => x.key === this.autoEnterKey);
          this.autoEnterKey = null;
          if (b) this.enterBuilding(b);
          return;
        }
      } else {
        const moved = this.movePlayer(tx / dist, ty / dist, dt);
        if (!moved) {
          this.moveTarget = null; // 卡到牆就停
          this.autoEnterKey = null;
        }
      }
    }

    const door = this.nearDoor();
    const atDock =
      this.player.y > TOWN_H - 160 && Math.abs(this.player.x - this.dock.x) < 200;

    if (door) {
      this.hint.setText(`按 Enter 進入【${door.label}】`);
    } else if (atDock) {
      this.hint.setText('按 Enter 出航');
    } else {
      this.hint.setText('方向鍵走動或滑鼠點擊目的地｜點建築會自動走過去進入｜到棧橋按 Enter 出航');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      if (door) {
        this.enterBuilding(door);
      } else if (atDock) {
        saveGame(this.state);
        this.scene.start('WorldMap');
      }
    }

    const mm = this.registry.get('townMini') as { mx: number; my: number; sx: number; sy: number };
    if (mm && this.miniPlayer) {
      this.miniPlayer.setPosition(mm.mx + this.player.x * mm.sx, mm.my + this.player.y * mm.sy);
    }
  }

  /** 回傳是否實際移動（撞牆回 false） */
  private movePlayer(nx: number, ny: number, dt: number): boolean {
    const px = Phaser.Math.Clamp(this.player.x + nx * PLAYER_SPEED * dt, 16, TOWN_W - 16);
    const py = Phaser.Math.Clamp(this.player.y + ny * PLAYER_SPEED * dt, 96, TOWN_H - 60);
    if (this.hitsBuilding(px, py)) return false;
    this.player.setPosition(px, py);
    return true;
  }

  private enterBuilding(b: Building): void {
    const ret = { x: b.x, y: b.y + b.h / 2 + 26 };
    saveGame(this.state);
    if (b.key === 'trade') {
      this.scene.start('Trade', { portId: this.port.id, door: ret });
    } else {
      this.scene.start('Facility', { portId: this.port.id, type: b.key, door: ret });
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
      if (Math.abs(this.player.x - doorX) < 38 && this.player.y > doorY - 6 && this.player.y < doorY + 48) {
        return b;
      }
    }
    return null;
  }
}
