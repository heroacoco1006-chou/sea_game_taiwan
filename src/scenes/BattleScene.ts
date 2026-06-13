import Phaser from 'phaser';
import { GameState, shipTypeOf, hullMax, saveGame, PORTS } from '../state';
import { COLORS, textStyle, makeButton, drawPanel } from '../ui';

interface Enemy {
  name: string;
  hull: number;
  hullMax: number;
  cannons: number;
  crew: number;
  loot: number;
}

/**
 * 回合制海戰（M3 簡化版）：砲擊／接舷（士氣比拼，無血腥）／逃跑。
 * 敵船殘血可能掛白旗投降；我方船體歸零＝漂流獲救，不會 Game Over。
 */
export default class BattleScene extends Phaser.Scene {
  private enemy!: Enemy;
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private myText!: Phaser.GameObjects.Text;
  private foeText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];
  private busy = false;

  constructor() {
    super('Battle');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(): void {
    const s = this.state;
    // 敵人規模隨遊戲天數成長
    if (s.day < 60) {
      this.enemy = { name: '海盜小船', hull: 60, hullMax: 60, cannons: 2, crew: 10, loot: 120 + Math.floor(Math.random() * 120) };
    } else if (s.day < 180) {
      this.enemy = { name: '海盜戎克船', hull: 110, hullMax: 110, cannons: 4, crew: 20, loot: 250 + Math.floor(Math.random() * 250) };
    } else {
      this.enemy = { name: '海盜頭目的快船', hull: 160, hullMax: 160, cannons: 6, crew: 32, loot: 500 + Math.floor(Math.random() * 400) };
    }
    this.logLines = [];
    this.busy = false;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x16384e);
    // 海面波紋
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a6a8e, 0.5);
    for (let y = 60; y < H; y += 52) {
      for (let x = 20; x < W; x += 80) {
        g.beginPath();
        g.arc(x + ((y / 52) % 2) * 40, y, 10, Math.PI * 0.15, Math.PI * 0.85);
        g.strokePath();
      }
    }

    this.add.text(W / 2, 44, '⚔ 海戰 ⚔', textStyle(34, '#fff4d6')).setOrigin(0.5).setShadow(2, 2, '#000', 3);

    // 我方／敵方面板
    drawPanel(this, 70, 90, 480, 150);
    this.add.image(140, 150, 'ship').setScale(2.2);
    this.myText = this.add.text(220, 108, '', { ...textStyle(18), lineSpacing: 6 });

    drawPanel(this, W - 550, 90, 480, 150);
    const foeShip = this.add.image(W - 480, 150, 'ship').setScale(2.2).setFlipX(true).setTint(0x884444);
    this.foeText = this.add.text(W - 410, 108, '', { ...textStyle(18), lineSpacing: 6 });

    // 戰報
    drawPanel(this, 200, 290, 880, 210);
    this.logText = this.add.text(230, 310, '', { ...textStyle(18), lineSpacing: 9, wordWrap: { width: 820 } });

    // 指令
    this.buttons = [
      makeButton(this, W / 2 - 300, 580, 240, 56, '砲擊！', () => this.playerTurn('cannon')),
      makeButton(this, W / 2, 580, 240, 56, '接舷戰（拼士氣）', () => this.playerTurn('board')),
      makeButton(this, W / 2 + 300, 580, 240, 56, '逃跑', () => this.playerTurn('flee')),
    ];

    this.pushLog(`敵船【${this.enemy.name}】逼近！大砲 ${this.enemy.cannons} 門、船員約 ${this.enemy.crew} 人。`);
    this.refreshPanels();
  }

  private refreshPanels(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    this.myText.setText(`我方：${t.name}\n船體 ${Math.max(0, s.ship.hull)}/${t.hullMax}\n大砲 ${s.ship.cannons} 門　水手 ${s.crew} 人`);
    this.foeText.setText(`敵方：${this.enemy.name}\n船體 ${Math.max(0, this.enemy.hull)}/${this.enemy.hullMax}\n大砲 ${this.enemy.cannons} 門　船員 ${this.enemy.crew} 人`);
  }

  private pushLog(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 5) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  private setButtons(enabled: boolean): void {
    for (const b of this.buttons) {
      if (enabled) {
        b.setAlpha(1).setInteractive({ useHandCursor: true });
      } else {
        b.setAlpha(0.5).disableInteractive();
      }
    }
  }

  private playerTurn(action: 'cannon' | 'board' | 'flee'): void {
    if (this.busy) return;
    this.busy = true;
    this.setButtons(false);
    const s = this.state;

    if (action === 'cannon') {
      const dmg = Math.round((s.ship.cannons * 7 + s.crew / 4) * (0.8 + Math.random() * 0.4));
      this.enemy.hull -= dmg;
      this.pushLog(`我方齊射！轟出 ${dmg} 點損傷！`);
    } else if (action === 'board') {
      const myPower = s.crew * (0.8 + Math.random() * 0.4);
      const foePower = this.enemy.crew * (0.8 + Math.random() * 0.4);
      if (myPower > foePower) {
        this.pushLog('接舷成功！我方水手氣勢如虹，敵人嚇得舉白旗投降！');
        this.victory(true);
        return;
      }
      s.crew = Math.max(1, s.crew - 2);
      s.fatigue = Math.min(100, s.fatigue + 10);
      this.pushLog('接舷被打退了！兩名水手掛彩退下（水手 -2、疲勞 +10）');
    } else {
      const t = shipTypeOf(s);
      const chance = 0.45 + (t.speed - 1) * 0.6;
      if (Math.random() < chance) {
        this.pushLog('趁風轉舵——成功甩開敵船！');
        this.endBattle('（順利逃脫，繼續航行）');
        return;
      }
      this.pushLog('沒逃掉！敵船追了上來……');
    }

    this.refreshPanels();

    // 敵方回合
    this.time.delayedCall(700, () => {
      if (this.enemy.hull <= 0) {
        this.pushLog(`【${this.enemy.name}】冒出濃煙，緩緩下沉——敵人跳上小艇逃了！`);
        this.victory(false);
        return;
      }
      if (this.enemy.hull < this.enemy.hullMax * 0.25 && Math.random() < 0.35) {
        this.pushLog('敵船見勢不妙，掛起滿帆逃走了！');
        this.victory(false);
        return;
      }
      const s2 = this.state;
      const dmg = Math.round((this.enemy.cannons * 7 + this.enemy.crew / 4) * (0.8 + Math.random() * 0.4));
      s2.ship.hull -= dmg;
      this.pushLog(`敵方反擊！我方船體受損 ${dmg} 點！`);
      this.refreshPanels();
      if (s2.ship.hull <= 0) {
        this.defeat();
        return;
      }
      this.busy = false;
      this.setButtons(true);
    });
  }

  private victory(boarded: boolean): void {
    const s = this.state;
    const loot = boarded ? Math.round(this.enemy.loot * 1.5) : this.enemy.loot;
    s.gold += loot;
    this.refreshPanels();
    this.endBattle(`戰利品：${loot} 兩！${boarded ? '（接舷俘獲，繳獲加倍半）' : ''}`);
  }

  private defeat(): void {
    const s = this.state;
    let nearest = PORTS[0];
    let best = Number.MAX_VALUE;
    for (const p of PORTS) {
      const d = Phaser.Math.Distance.Between(s.ship.x, s.ship.y, p.x, p.y);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    const lost = Math.floor(s.gold * 0.3);
    s.gold -= lost;
    s.ship.hull = Math.round(hullMax(s) * 0.4);
    s.food = Math.min(s.food, 10);
    s.water = Math.min(s.water, 10);
    s.ship.x = nearest.x;
    s.ship.y = nearest.y + 26;
    saveGame(s);
    this.pushLog(`船撐不住了……幸好路過的商船把大家救到【${nearest.name}】（損失 ${lost} 兩）。`);
    this.endBattle('留得青山在，不怕沒柴燒！');
  }

  private endBattle(note: string): void {
    this.setButtons(false);
    this.pushLog(note);
    const W = this.scale.width;
    makeButton(this, W / 2, 660, 280, 54, '返回大海', () => {
      saveGame(this.state);
      this.scene.start('WorldMap');
    });
  }
}
