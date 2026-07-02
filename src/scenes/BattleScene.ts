import Phaser from 'phaser';
import {
  GameState, shipTypeOf, saveGame, PORTS,
  fleetCannons, fleetHull, fleetHullMax, fleetShips, shipTypeById, damageFleet,
  cannonMod, weaponBoard, boardBonus, reduceCrewLoss, addXp, levelUpMessage,
  addReputation, updateMateQuestProgress,
} from '../state';
import { shipBattleKey } from '../art';
import { audio } from '../audio';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, drawPanel, flashFx } from '../ui';

interface Enemy {
  name: string;
  hull: number;
  hullMax: number;
  cannons: number;
  crew: number;
  loot: number;
  shipType: string;
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
  private questCombat = false;
  private tier = 1;

  constructor() {
    super('Battle');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data?: { questCombat?: boolean }): void {
    const s = this.state;
    this.questCombat = Boolean(data?.questCombat);
    // 敵人規模隨遊戲天數成長
    const tier = s.quest?.type === 'combat' ? s.quest.enemyTier : s.day < 60 ? 1 : s.day < 180 ? 2 : 3;
    this.tier = tier;
    if (tier <= 1) {
      this.enemy = { name: '海盜小船', hull: 60, hullMax: 60, cannons: 2, crew: 10, loot: 120 + Math.floor(Math.random() * 120), shipType: 'junk_small' };
    } else if (tier <= 2) {
      this.enemy = { name: '海盜戎克船', hull: 110, hullMax: 110, cannons: 4, crew: 20, loot: 250 + Math.floor(Math.random() * 250), shipType: 'junk_large' };
    } else {
      this.enemy = { name: '海盜頭目的快船', hull: 160, hullMax: 160, cannons: 6, crew: 32, loot: 500 + Math.floor(Math.random() * 400), shipType: 'fuchuan' };
    }
    this.logLines = [];
    this.busy = false;
  }

  create(): void {
    const W = BASE_W;
    const H = BASE_H;
    audio.playBgm('battle');
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
    this.addShip(150, 165, shipTypeOf(this.state).id, false);
    this.myText = this.add.text(250, 104, '', { ...textStyle(17), lineSpacing: 5 });

    drawPanel(this, W - 550, 90, 480, 150);
    this.addShip(W - 470, 165, this.enemy.shipType, true, 0x884444);
    this.foeText = this.add.text(W - 400, 104, '', { ...textStyle(17), lineSpacing: 5 });

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

  /** 海戰面板的船隻圖：有 V2 海戰 sprite 就用，否則退回程式生成的 'ship' */
  private addShip(x: number, y: number, typeId: string, flip: boolean, tint?: number): void {
    const key = shipBattleKey(typeId);
    const useV2 = this.textures.exists(key);
    const img = this.add.image(x, y, useV2 ? key : 'ship');
    if (useV2) img.setDisplaySize(140, 79); else img.setScale(2.2);
    img.setFlipX(flip);
    if (tint !== undefined) img.setTint(tint);
  }

  private refreshPanels(): void {
    const s = this.state;
    const t = shipTypeOf(s);
    const fleetName = s.escorts.length > 0 ? `${t.name}艦隊（${1 + s.escorts.length}艘）` : t.name;
    this.myText.setText(`我方：${fleetName}\n船體 ${Math.max(0, fleetHull(s))}/${fleetHullMax(s)}\n大砲 ${fleetCannons(s)} 門　水手 ${s.crew} 人`);
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
      audio.playSfx('cannon');
      const dmg = Math.round((fleetCannons(s) * 7 + s.crew / 4) * cannonMod(s) * (0.8 + Math.random() * 0.4));
      this.enemy.hull -= dmg;
      this.pushLog(`我方齊射！轟出 ${dmg} 點損傷！`);
    } else if (action === 'board') {
      audio.playSfx('board');
      const myPower = (s.crew + weaponBoard(s) * 1.5 + boardBonus(s)) * (0.8 + Math.random() * 0.4);
      const foePower = this.enemy.crew * (0.8 + Math.random() * 0.4);
      if (myPower > foePower) {
        this.pushLog('接舷成功！我方水手氣勢如虹，敵人嚇得舉白旗投降！');
        this.victory(true);
        return;
      }
      const loss = reduceCrewLoss(s) ? 1 : 2;
      s.crew = Math.max(1, s.crew - loss);
      s.fatigue = Math.min(100, s.fatigue + 10);
      this.pushLog(`接舷被打退了！${loss} 名水手掛彩退下（水手 -${loss}、疲勞 +10）`);
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
      damageFleet(s2, dmg);
      this.pushLog(`敵方反擊！我方船體受損 ${dmg} 點！`);
      this.refreshPanels();
      if (fleetHull(s2) <= fleetShips(s2).length) {
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
    if (this.questCombat && s.quest?.type === 'combat') {
      s.quest.completed = true;
    }
    // 海上威名（依敵方強度加權）＋海戰勝場統計＋夥伴任務巡檢
    s.battleWins = (s.battleWins ?? 0) + 1;
    const repMsg = addReputation(s, 'valor', 2 + this.tier);
    const questMsgs = updateMateQuestProgress(s);
    audio.playSfx('victory');
    const lv = levelUpMessage(addXp(s, 40 + Math.min(40, Math.round(loot / 30))));
    if (lv) { audio.playSfx('levelup'); flashFx(this, BASE_W / 2, BASE_H / 2); }
    this.refreshPanels();
    this.endBattle(`戰利品：${loot} 兩！${boarded ? '（接舷俘獲，繳獲加倍半）' : ''}${repMsg ? `\n${repMsg}` : ''}${this.questCombat ? '\n海戰委託已完成，回接任務的官府／商館領賞。' : ''}${lv ? `\n${lv}` : ''}${questMsgs.length ? `\n${questMsgs.join('\n')}` : ''}`);
  }

  private defeat(): void {
    audio.playSfx('defeat');
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
    for (const sh of fleetShips(s)) {
      sh.hull = Math.round(shipTypeById(sh.typeId).hullMax * 0.4);
    }
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
    const W = BASE_W;
    makeButton(this, W / 2, 660, 280, 54, '返回大海', () => {
      saveGame(this.state);
      this.scene.start('WorldMap');
    });
  }
}
