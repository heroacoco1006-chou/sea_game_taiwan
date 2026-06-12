import Phaser from 'phaser';
import {
  GameState, PORTS, Port, saveGame, dateText, rumorTexts,
  HULL_MAX, SUPPLY_MAX,
} from '../state';
import { textStyle, makeButton, drawPanel, toast } from '../ui';

type FacilityType = 'tavern' | 'inn' | 'harbor' | 'shipyard' | 'office';

const FOOD_PRICE = 2;
const WATER_PRICE = 1;
const REPAIR_PRICE = 2;

/** 對談式設施選單（走進建築後切換到此場景） */
export default class FacilityScene extends Phaser.Scene {
  private port!: Port;
  private type!: FacilityType;
  private door!: { x: number; y: number };
  private info!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;

  constructor() {
    super('Facility');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; type: FacilityType; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.type = data.type;
    this.door = data.door;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);

    const titles: Record<FacilityType, string> = {
      tavern: '酒館',
      inn: '旅館',
      harbor: '港務局',
      shipyard: '造船廠',
      office: this.port.culture === 'han' ? '官府' : '商館',
    };

    drawPanel(this, 80, 40, W - 160, H - 120);
    this.add.text(W / 2, 80, `${this.port.name}・${titles[this.type]}`, textStyle(32)).setOrigin(0.5);
    this.info = this.add.text(120, 120, '', textStyle(19, '#6b5530'));
    this.body = this.add
      .text(120, 165, '', { ...textStyle(20), wordWrap: { width: W - 280 }, lineSpacing: 8 })
      .setOrigin(0, 0);

    this.buildContent();

    makeButton(this, W / 2, H - 56, 220, 52, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    });
  }

  private refreshInfo(): void {
    const s = this.state;
    this.info.setText(
      `${dateText(s.day)}　資金 ${s.gold} 兩　糧 ${s.food}/${SUPPLY_MAX}　水 ${s.water}/${SUPPLY_MAX}　船體 ${s.ship.hull}/${HULL_MAX}`
    );
  }

  private buildContent(): void {
    const W = this.scale.width;
    this.refreshInfo();
    const s = this.state;

    switch (this.type) {
      case 'tavern': {
        const rumors = rumorTexts(s).map((r) => `🍺 ${r}`).join('\n\n');
        this.body.setText(
          `老闆娘端來一杯熱茶：「客人，聽聽最近的消息吧——」\n\n${rumors}\n\n（在酒館雇用航海士的功能，將在之後的版本開放）`
        );
        break;
      }

      case 'inn': {
        this.body.setText('掌櫃笑著迎上來：「客倌，休息一晚嗎？順便把您的航海日誌收好（存檔）。」');
        makeButton(this, W / 2, 420, 320, 54, '休息一晚並存檔（免費）', () => {
          s.day += 1;
          s.ship.hull = Math.min(HULL_MAX, s.ship.hull + 3);
          saveGame(s);
          this.refreshInfo();
          toast(this, '睡了個好覺！進度已存檔（船員順手保養了船，船體+3）');
        });
        break;
      }

      case 'harbor': {
        this.body.setText(
          `港務官攤開帳本：「出海前記得補給！糧食一單位 ${FOOD_PRICE} 兩、清水一單位 ${WATER_PRICE} 兩。」\n\n（小知識：大航海時代的船員最怕缺糧缺水，長期吃不到新鮮蔬果會得壞血病！）`
        );
        makeButton(this, W / 2 - 240, 460, 220, 50, `糧食 +10（${FOOD_PRICE * 10} 兩）`, () => {
          this.buySupply('food', 10);
        });
        makeButton(this, W / 2, 460, 220, 50, `清水 +10（${WATER_PRICE * 10} 兩）`, () => {
          this.buySupply('water', 10);
        });
        makeButton(this, W / 2 + 240, 460, 220, 50, '糧水全部補滿', () => {
          const needF = SUPPLY_MAX - s.food;
          const needW = SUPPLY_MAX - s.water;
          const cost = needF * FOOD_PRICE + needW * WATER_PRICE;
          if (cost === 0) {
            toast(this, '糧水已經是滿的了！');
            return;
          }
          if (s.gold < cost) {
            toast(this, `補滿需要 ${cost} 兩，資金不足！`);
            return;
          }
          s.gold -= cost;
          s.food = SUPPLY_MAX;
          s.water = SUPPLY_MAX;
          this.refreshInfo();
          toast(this, `補滿了！花費 ${cost} 兩`);
        });
        break;
      }

      case 'shipyard': {
        this.body.setText(
          `船匠敲著木槌：「船體每修 1 點收 ${REPAIR_PRICE} 兩。」\n\n（買船、造船、改造的功能，將在下一階段開放——敬請期待！）`
        );
        makeButton(this, W / 2, 460, 320, 54, '修理到全滿', () => {
          const need = HULL_MAX - s.ship.hull;
          if (need === 0) {
            toast(this, '船體完好如新，不用修！');
            return;
          }
          const afford = Math.min(need, Math.floor(s.gold / REPAIR_PRICE));
          if (afford <= 0) {
            toast(this, '資金不足！');
            return;
          }
          s.gold -= afford * REPAIR_PRICE;
          s.ship.hull += afford;
          this.refreshInfo();
          toast(this, afford === need ? `修好了！花費 ${afford * REPAIR_PRICE} 兩` : `錢只夠修 ${afford} 點`);
        });
        break;
      }

      case 'office': {
        this.body.setText(
          `${this.port.culture === 'han' ? '官爺' : '商館長'}放下手中的文書，向你介紹這座港口：\n\n「${this.port.desc}」\n\n（接受任務、委託的功能，將在之後的版本開放）`
        );
        break;
      }
    }
  }

  private buySupply(kind: 'food' | 'water', amount: number): void {
    const s = this.state;
    const price = kind === 'food' ? FOOD_PRICE : WATER_PRICE;
    const cur = s[kind];
    const can = Math.min(amount, SUPPLY_MAX - cur, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, cur >= SUPPLY_MAX ? '已經滿了！' : '資金不足！');
      return;
    }
    s.gold -= can * price;
    s[kind] = cur + can;
    this.refreshInfo();
    if (can < amount) toast(this, `只補了 ${can} 單位`);
  }
}
