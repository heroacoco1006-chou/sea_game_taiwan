import Phaser from 'phaser';
import {
  GameState, PORTS, Port, MATE_DEFS, ROLES, mateDefById, roleName, saveGame,
  mateRequirementStatus, mateQuestStageStatuses, recruitMate, getMateScript,
  mateConditionChecklist, mateNextStepText, mateUnavailableReason,
  mateQuestProgress, acceptMateQuest, reportableMateQuestStageIndex, reportMateQuestStage,
  updateMateQuestProgress,
} from '../state';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, drawPanel, showModal, toast, selectionRing } from '../ui';
import { audio, townBgmForRegion } from '../audio';

/**
 * 夥伴：招募本港的夥伴、指派幹部職位（同職位互斥）。
 * M3 為框架（少數 ★1~2 示範夥伴，付費招募）；
 * 完整 25 位與專屬招募任務於 M4 實作。
 */
export default class MatesScene extends Phaser.Scene {
  private port!: Port;
  private door!: { x: number; y: number };
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private header!: Phaser.GameObjects.Text;
  private crewPage = 0;
  private candidatePage = 0;
  private detail: Phaser.GameObjects.Container | null = null;
  private detailWheel?: (pointer: Phaser.Input.Pointer, objects: unknown, dx: number, dy: number) => void;

  constructor() {
    super('Mates');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { portId: string; door: { x: number; y: number } }): void {
    this.port = PORTS.find((p) => p.id === data.portId)!;
    this.door = data.door ?? { x: 640, y: 600 };
    this.dyn = [];
    this.crewPage = 0;
    this.candidatePage = 0;
  }

  create(): void {
    audio.playBgm(townBgmForRegion(this.port.region));
    // 進酒館先巡檢夥伴任務：把已達成的階段鎖存並提示
    const questMsgs = updateMateQuestProgress(this.state);
    if (questMsgs.length) {
      saveGame(this.state);
      toast(this, questMsgs.join('\n'), 640, 130);
    }
    const W = BASE_W;
    const H = BASE_H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 30, 16, W - 60, H - 32);
    this.add.text(W / 2, 44, `${this.port.name}・夥伴`, textStyle(26)).setOrigin(0.5);
    this.header = this.add.text(W / 2, 76, '', textStyle(15, '#6b5530')).setOrigin(0.5);

    this.add.text(330, 108, '— 我的夥伴（點職位指派，同職位只能一人）—', textStyle(16)).setOrigin(0.5);
    this.add.text(960, 108, '— 本港可結識的夥伴（點名字看詳情）—', textStyle(16)).setOrigin(0.5);

    makeButton(this, W / 2, H - 44, 220, 48, '離開（回到街上）', () => {
      saveGame(this.state);
      this.scene.start('Port', { portId: this.port.id, spawn: this.door });
    });

    this.rebuild();
  }

  private rebuild(): void {
    const s = this.state;
    const pageSize = 5;
    this.header.setText(`資金 ${s.gold} 兩　　已招募 ${s.mates.length}/${MATE_DEFS.length} 位夥伴`);
    for (const o of this.dyn) o.destroy();
    this.dyn = [];

    // ---- 左：我的夥伴 ----
    if (s.mates.length === 0) {
      this.dyn.push(this.add.text(330, 200, '（還沒有夥伴，去右邊結識吧！）', textStyle(16, '#8a7a58')).setOrigin(0.5));
    }
    const crewPages = Math.max(1, Math.ceil(s.mates.length / pageSize));
    this.crewPage = Math.min(this.crewPage, crewPages - 1);
    const crew = s.mates.slice(this.crewPage * pageSize, this.crewPage * pageSize + pageSize);
    crew.forEach((m, i) => {
      const def = mateDefById(m.id);
      if (!def) return;
      const y = 150 + i * 92;
      this.dyn.push(this.add.text(70, y, `${def.name} ★${def.star}　現任：${roleName(m.role)}`, textStyle(17)));
      // 可任職位按鈕
      def.roles.forEach((rk, j) => {
        const role = ROLES.find((r) => r.key === rk)!;
        const active = m.role === rk;
        const btn = makeButton(this, 110 + j * 132, y + 42, 122, 36, active ? `✓${role.name}` : role.name, () => this.assign(m.id, rk), 13);
        if (active) this.dyn.push(selectionRing(this, 110 + j * 132, y + 42, 122, 36));
        this.dyn.push(btn);
      });
      // 解除職位
      const off = makeButton(this, 110 + def.roles.length * 132, y + 42, 90, 36, '不指派', () => this.assign(m.id, null), 12);
      this.dyn.push(off);
      const chat = makeButton(this, 555, y + 42, 100, 36, '聊聊天', () => this.chat(m.id), 12);
      this.dyn.push(chat);
    });
    if (crewPages > 1) {
      this.dyn.push(makeButton(this, 240, 620, 120, 34, '上一頁', () => { this.crewPage = Math.max(0, this.crewPage - 1); this.rebuild(); }, 13));
      this.dyn.push(this.add.text(330, 620, `${this.crewPage + 1}/${crewPages}`, textStyle(14)).setOrigin(0.5));
      this.dyn.push(makeButton(this, 420, 620, 120, 34, '下一頁', () => { this.crewPage = Math.min(crewPages - 1, this.crewPage + 1); this.rebuild(); }, 13));
    }

    // ---- 右：可結識 ----
    const pool = MATE_DEFS.filter((d) => d.portId === this.port.id && !s.mates.some((m) => m.id === d.id));
    if (pool.length === 0) {
      this.dyn.push(this.add.text(960, 200, '（這座港口目前沒有可結識的夥伴）', { ...textStyle(15, '#8a7a58'), wordWrap: { width: 500 }, align: 'center' }).setOrigin(0.5));
    }
    const candidatePages = Math.max(1, Math.ceil(pool.length / pageSize));
    this.candidatePage = Math.min(this.candidatePage, candidatePages - 1);
    const candidates = pool.slice(this.candidatePage * pageSize, this.candidatePage * pageSize + pageSize);
    candidates.forEach((def, i) => {
      const y = 150 + i * 92;
      const roleNames = def.roles.map((rk) => roleName(rk)).join('／');
      const status = mateRequirementStatus(s, def);
      const unavailable = mateUnavailableReason(s, def);
      const stages = mateQuestStageStatuses(s, def);
      const stageText = stages.length ? `（任務 ${stages.filter((stage) => stage.ok).length}/${stages.length}）` : '';
      // 名字可點開詳情視窗
      const nameT = this.add.text(680, y, `${def.name} ★${def.star}（${def.from}）`, textStyle(17));
      nameT.setInteractive({ useHandCursor: true });
      nameT.on('pointerdown', () => this.showMateDetail(def.id));
      this.dyn.push(nameT);
      this.dyn.push(this.add.text(680, y + 26, def.desc, { ...textStyle(12, '#5a4a30'), wordWrap: { width: 410, useAdvancedWrap: true } }));
      // 第三行：達成→可任職位；未達成→下一步提示；本線不可招募→明確標示
      let line3: string;
      let line3Color: string;
      if (unavailable) {
        line3 = `✖ ${unavailable}`;
        line3Color = '#8a5a4a';
      } else if (status.ok) {
        line3 = `可任：${roleNames}｜${def.questTitle}`;
        line3Color = '#6b5530';
      } else {
        line3 = `下一步：${mateNextStepText(s, def)}${stageText}`;
        line3Color = '#9a4a2a';
      }
      this.dyn.push(this.add.text(680, y + 54, line3, { ...textStyle(13, line3Color), wordWrap: { width: 430, useAdvancedWrap: true } }));
      // 按鈕依任務狀態切換：接任務 → 回報任務 → 結識；不可招募＝查看說明；其餘＝查看條件
      const hasQuest = (def.questStages ?? []).length > 0;
      const prog = mateQuestProgress(s, def.id);
      const canAccept = hasQuest && !prog && !unavailable;
      const canReport = hasQuest && !!prog && reportableMateQuestStageIndex(s, def) >= 0;
      let label: string;
      let onClick: () => void;
      if (unavailable) {
        label = '查看說明';
        onClick = () => this.showMateDetail(def.id);
      } else if (status.ok) {
        label = def.fee > 0 ? `結識 ${def.fee}兩` : '邀請加入';
        onClick = () => this.recruit(def.id);
      } else if (canAccept) {
        label = '接任務';
        onClick = () => this.acceptQuest(def.id);
      } else if (canReport) {
        label = '回報任務';
        onClick = () => this.reportQuest(def.id);
      } else {
        label = '查看條件';
        onClick = () => this.showMateDetail(def.id);
      }
      const btn = makeButton(this, 1130, y + 34, 150, 42, label, onClick, 13);
      if (unavailable) btn.setAlpha(0.55);
      else if (!status.ok && !canAccept && !canReport) btn.setAlpha(0.78);
      this.dyn.push(btn);
    });
    if (candidatePages > 1) {
      this.dyn.push(makeButton(this, 870, 620, 120, 34, '上一頁', () => { this.candidatePage = Math.max(0, this.candidatePage - 1); this.rebuild(); }, 13));
      this.dyn.push(this.add.text(960, 620, `${this.candidatePage + 1}/${candidatePages}`, textStyle(14)).setOrigin(0.5));
      this.dyn.push(makeButton(this, 1050, 620, 120, 34, '下一頁', () => { this.candidatePage = Math.min(candidatePages - 1, this.candidatePage + 1); this.rebuild(); }, 13));
    }
  }

  private acceptQuest(id: string): void {
    const res = acceptMateQuest(this.state, id);
    saveGame(this.state);
    this.rebuild();
    toast(this, res.msg, 640, 130);
  }

  private reportQuest(id: string): void {
    const res = reportMateQuestStage(this.state, id);
    saveGame(this.state);
    this.rebuild();
    toast(this, res.msg, 640, 130);
  }

  private recruit(id: string): void {
    const s = this.state;
    const def = mateDefById(id);
    if (!def) return;
    const status = mateRequirementStatus(s, def);
    if (!status.ok) {
      this.showMateDetail(id);
      return;
    }
    if (s.gold < def.fee) {
      toast(this, '資金不足，付不出謝禮！');
      return;
    }
    // 高星夥伴有專屬招募劇情 → 先播劇情，播完由 StoryScene 完成入隊
    if (getMateScript(id)) {
      saveGame(s);
      this.scene.start('Story', {
        mode: 'mate',
        mateId: id,
        ret: { scene: 'Mates', portId: this.port.id, door: this.door },
      });
      return;
    }
    // 一般夥伴：直接入隊
    const result = recruitMate(s, id);
    saveGame(s);
    this.rebuild();
    if (result.ok) {
      toast(this, `${def.name} 加入了船隊，擔任${roleName(result.roleKey)}${result.unlocked.length ? '，人物圖鑑已解鎖' : ''}！`);
      if (result.levelMsg) toast(this, result.levelMsg, 640, 130);
    }
  }

  /** 專用夥伴詳情視窗：完整條件打勾清單＋任務進度＋下一步，內容過長可捲動（取代會裁字的通用短彈窗）。 */
  private showMateDetail(id: string): void {
    if (this.detail) return;
    const s = this.state;
    const def = mateDefById(id);
    if (!def) return;
    const status = mateRequirementStatus(s, def);
    const unavailable = mateUnavailableReason(s, def);
    const stages = mateQuestStageStatuses(s, def);
    const portName = PORTS.find((p) => p.id === def.portId)?.name ?? def.portId;
    const roleNames = def.roles.map((rk) => roleName(rk)).join('／');

    const w = 940;
    const h = 620;
    const x = (BASE_W - w) / 2;
    const y = (BASE_H - h) / 2;

    // 擋住下層互動的半透明底
    const dim = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.5).setInteractive();
    const panel = drawPanel(this, x, y, w, h);
    const titleT = this.add.text(BASE_W / 2, y + 34, `${def.name} ★${def.star}｜${def.questTitle}`, textStyle(24)).setOrigin(0.5);
    const infoT = this.add
      .text(BASE_W / 2, y + 66, `所在港：${portName}　結識費：${def.fee > 0 ? `${def.fee} 兩` : '免費'}　可任職位：${roleNames}`, textStyle(15, '#6b5530'))
      .setOrigin(0.5);

    // 內文：人物介紹＋加入條件打勾清單＋專屬任務進度＋下一步
    const lines: string[] = [];
    lines.push(def.desc);
    lines.push(`（${def.history}）`);
    const baseItems = mateConditionChecklist(s, def.requirement);
    lines.push('');
    lines.push('【加入條件】');
    if (baseItems.length === 0 && stages.length === 0) {
      lines.push('・付出謝禮即可邀請。');
    } else if (baseItems.length === 0) {
      lines.push('・完成下方專屬任務。');
    } else {
      for (const it of baseItems) lines.push(`${it.met ? '✅' : '⬜'} ${it.text}`);
    }
    if (stages.length) {
      lines.push('');
      lines.push(`【專屬任務】進度 ${stages.filter((st) => st.ok).length}/${stages.length}`);
      stages.forEach((st, i) => {
        lines.push(`${st.ok ? '✅' : '⬜'} ${i + 1}. ${st.title}`);
        lines.push(`　　${st.desc}`);
        if (!st.ok) for (const l of st.lines) lines.push(`　　▸ ${l}`);
      });
    }
    lines.push('');
    if (unavailable) lines.push(`✖ ${unavailable}`);
    else if (status.ok) lines.push('✅ 條件已達成，可以邀請加入！');
    else lines.push(`👉 下一步：${mateNextStepText(s, def)}`);

    const bodyTop = y + 92;
    const bodyH = h - 92 - 76; // 底部留按鈕區
    const bodyT = this.add.text(x + 46, bodyTop, lines.join('\n'), {
      ...textStyle(17),
      wordWrap: { width: w - 150, useAdvancedWrap: true },
      lineSpacing: 8,
    });
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(x + 40, bodyTop, w - 80, bodyH);
    maskG.setVisible(false);
    bodyT.setMask(maskG.createGeometryMask());

    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, titleT, infoT, bodyT, maskG];

    // 內容超出可視區時提供捲動（▲▼ 按鈕＋滑鼠滾輪）
    const maxScroll = Math.max(0, bodyT.height - bodyH);
    if (maxScroll > 0) {
      let scroll = 0;
      const step = 130;
      const apply = () => { bodyT.y = bodyTop - scroll; };
      const up = makeButton(this, x + w - 58, bodyTop + 26, 56, 44, '▲', () => { scroll = Math.max(0, scroll - step); apply(); }, 16);
      const down = makeButton(this, x + w - 58, bodyTop + bodyH - 26, 56, 44, '▼', () => { scroll = Math.min(maxScroll, scroll + step); apply(); }, 16);
      parts.push(up, down);
      this.detailWheel = (_pointer, _objects, _dx, dy) => {
        scroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScroll);
        apply();
      };
      this.input.on('wheel', this.detailWheel);
    }

    // 底部按鈕：依狀態提供 結識／接任務／回報任務，一律附關閉
    const canRecruit = !unavailable && status.ok;
    const hasQuest = (def.questStages ?? []).length > 0;
    const prog = mateQuestProgress(s, def.id);
    const atOwnPort = def.portId === this.port.id;
    let action: { label: string; onClick: () => void } | null = null;
    if (canRecruit) {
      action = {
        label: def.fee > 0 ? `結識 ${def.fee}兩` : '邀請加入',
        onClick: () => { this.closeDetail(); this.recruit(def.id); },
      };
    } else if (hasQuest && !prog && !unavailable && atOwnPort) {
      action = { label: '接下任務', onClick: () => { this.closeDetail(); this.acceptQuest(def.id); } };
    } else if (hasQuest && prog && atOwnPort && reportableMateQuestStageIndex(s, def) >= 0) {
      action = { label: '回報任務', onClick: () => { this.closeDetail(); this.reportQuest(def.id); } };
    }
    if (action) {
      parts.push(makeButton(this, BASE_W / 2 - 130, y + h - 40, 230, 46, action.label, action.onClick, 17));
    }
    parts.push(makeButton(this, action ? BASE_W / 2 + 130 : BASE_W / 2, y + h - 40, 230, 46, '知道了（關閉）', () => this.closeDetail(), 17));

    this.detail = this.add.container(0, 0, parts);
    this.detail.setDepth(2000);
    this.detail.setScrollFactor(0);
    this.detail.setAlpha(0);
    this.tweens.add({ targets: this.detail, alpha: 1, duration: 140, ease: 'Quad.easeOut' });
  }

  private closeDetail(): void {
    if (!this.detail) return;
    this.detail.destroy();
    this.detail = null;
    if (this.detailWheel) {
      this.input.off('wheel', this.detailWheel);
      this.detailWheel = undefined;
    }
  }

  private assign(mateId: string, roleKey: string | null): void {
    this.assignRole(mateId, roleKey);
    saveGame(this.state);
    this.rebuild();
    if (roleKey) toast(this, `指派為${roleName(roleKey)}！`);
  }


  /** 顯示已入隊夥伴的專屬日常對話；每次隨機抽一句，方便玩家反覆認識人物。 */
  private chat(mateId: string): void {
    const def = mateDefById(mateId);
    if (!def?.dialogues?.length) return;
    const line = Phaser.Utils.Array.GetRandom(def.dialogues);
    showModal(this, def.name, `「${line}」`, [{ label: '知道了', onPick: () => {} }]);
  }
  /** 設定職位並維持同職位互斥 */
  private assignRole(mateId: string, roleKey: string | null): void {
    const s = this.state;
    if (roleKey) {
      for (const m of s.mates) {
        if (m.role === roleKey && m.id !== mateId) m.role = null;
      }
    }
    const me = s.mates.find((m) => m.id === mateId);
    if (me) me.role = roleKey;
  }
}
