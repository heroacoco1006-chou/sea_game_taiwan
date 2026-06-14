import Phaser from 'phaser';
import {
  newGame, loadGame, saveGame, deleteSave, listSaveSlots,
} from '../state';
import type { GameState, HeroId, SaveSlotInfo } from '../state';
import { COLORS, textStyle, makeButton, drawPanel, showModal, toast } from '../ui';

type SlotMode = 'new' | 'load' | 'save';
interface ReturnTo {
  scene: 'Title' | 'WorldMap' | 'Port';
  portId?: string;
  spawn?: { x: number; y: number };
}

/**
 * 存讀檔位置選擇畫面（10 格）。
 * - new：選好主角後，挑一格開始新遊戲（會覆蓋舊存檔，先確認）
 * - load：挑一格已存在的存檔讀取
 * - save：遊戲中把目前進度存到指定格
 */
export default class SaveSlotScene extends Phaser.Scene {
  private mode: SlotMode = 'load';
  private heroId: HeroId = 'lin';
  private ret: ReturnTo = { scene: 'Title' };
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('SaveSlot');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { mode?: SlotMode; heroId?: HeroId; ret?: ReturnTo }): void {
    this.mode = data.mode ?? 'load';
    this.heroId = data.heroId ?? 'lin';
    this.ret = data.ret ?? { scene: 'Title' };
    this.dyn = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.seaDeep);
    drawPanel(this, 40, 24, W - 80, H - 48);

    const title =
      this.mode === 'new' ? '選擇要開始新遊戲的存檔位置'
      : this.mode === 'save' ? '選擇要存檔的位置'
      : '選擇要讀取的存檔';
    this.add.text(W / 2, 64, title, textStyle(28)).setOrigin(0.5);

    const hint =
      this.mode === 'new' ? '挑一個空格開始；選到已有進度的格子會先問你要不要覆蓋。'
      : this.mode === 'save' ? '挑一格存檔；之後的自動存檔會跟著存在這一格。'
      : '只能讀取有進度的格子（灰色是空的）。';
    this.add.text(W / 2, 100, hint, textStyle(15, '#6b5530')).setOrigin(0.5);

    makeButton(this, W - 150, H - 56, 220, 46, '返回', () => this.goBack());

    this.render();
  }

  private render(): void {
    for (const obj of this.dyn) obj.destroy();
    this.dyn = [];

    const slots = listSaveSlots();
    // 兩欄各 5 列
    slots.forEach((info, i) => {
      const col = Math.floor(i / 5);
      const row = i % 5;
      const x = 340 + col * 600;
      const y = 175 + row * 92;
      this.drawSlot(info, x, y);
    });
  }

  private drawSlot(info: SaveSlotInfo, x: number, y: number): void {
    const w = 540;
    const h = 78;
    const num = info.slot + 1;

    const card = this.add.graphics();
    card.fillStyle(info.exists ? COLORS.parchment : COLORS.parchmentDark, info.exists ? 1 : 0.55);
    card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    card.lineStyle(2, COLORS.wood, 0.8);
    card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    this.dyn.push(card);

    this.dyn.push(this.add.text(x - w / 2 + 18, y - 26, `第 ${num} 格`, textStyle(18)).setOrigin(0, 0));

    const desc = info.exists
      ? `${info.heroName ?? '？'}　${info.date ?? ''}　${(info.gold ?? 0).toLocaleString()} 兩　第 ${info.chapter ?? '?'} 章`
      : '（空的）';
    this.dyn.push(
      this.add.text(x - w / 2 + 18, y + 4, desc, textStyle(15, info.exists ? '#5a4a30' : '#8a7448'))
        .setOrigin(0, 0)
    );

    // 主操作按鈕
    const canPick = this.mode === 'save' || this.mode === 'new' || info.exists;
    const actionLabel = this.mode === 'load' ? '讀取' : '存到這格';
    const btn = makeButton(this, x + w / 2 - 90, y - 18, 140, 38, actionLabel, () => this.pick(info), 15);
    if (!canPick) btn.setAlpha(0.4).disableInteractive();
    this.dyn.push(btn);

    // 刪除按鈕（任何模式，只要該格有存檔）
    if (info.exists) {
      const del = makeButton(this, x + w / 2 - 90, y + 20, 140, 30, '刪除', () => this.confirmDelete(info), 13);
      this.dyn.push(del);
    }
  }

  private pick(info: SaveSlotInfo): void {
    if (this.mode === 'load') {
      if (!info.exists) return;
      const s = loadGame(info.slot);
      if (!s) {
        toast(this, '這格存檔讀取失敗。');
        return;
      }
      this.registry.set('state', s);
      this.scene.start('WorldMap');
      return;
    }

    // new / save：若該格已有進度，先確認覆蓋
    if (info.exists) {
      showModal(
        this,
        `覆蓋第 ${info.slot + 1} 格？`,
        `這格已經有進度（${info.heroName ?? '？'}・${info.date ?? ''}）。\n覆蓋後原本的進度會不見，確定嗎？`,
        [
          { label: '覆蓋', onPick: () => this.commit(info.slot) },
          { label: '取消', onPick: () => {} },
        ]
      );
      return;
    }
    this.commit(info.slot);
  }

  private commit(slot: number): void {
    if (this.mode === 'new') {
      const s = newGame(this.heroId);
      saveGame(s, slot);
      this.registry.set('state', s);
      this.scene.start('WorldMap');
    } else {
      // save 模式：存目前進度，存完回到遊戲
      saveGame(this.state, slot);
      toast(this, `已存到第 ${slot + 1} 格，之後會自動存在這一格。`);
      this.time.delayedCall(700, () => this.goBack());
    }
  }

  private confirmDelete(info: SaveSlotInfo): void {
    showModal(
      this,
      `刪除第 ${info.slot + 1} 格？`,
      `要刪掉這格的進度（${info.heroName ?? '？'}・${info.date ?? ''}）嗎？刪了就拿不回來。`,
      [
        {
          label: '刪除',
          onPick: () => {
            deleteSave(info.slot);
            this.render();
            toast(this, `已刪除第 ${info.slot + 1} 格。`);
          },
        },
        { label: '取消', onPick: () => {} },
      ]
    );
  }

  private goBack(): void {
    if (this.ret.scene === 'Port' && this.ret.portId) {
      this.scene.start('Port', { portId: this.ret.portId, spawn: this.ret.spawn });
    } else {
      this.scene.start(this.ret.scene);
    }
  }
}
