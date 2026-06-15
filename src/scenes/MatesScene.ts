import Phaser from 'phaser';
import {
  GameState, PORTS, Port, MATE_DEFS, ROLES, mateDefById, roleName, saveGame,
  mateRequirementStatus, unlockCodex, mateCodexId,
} from '../state';
import { COLORS, textStyle, makeButton, drawPanel, toast, showModal } from '../ui';

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
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 30, 16, W - 60, H - 32);
    this.add.text(W / 2, 44, `${this.port.name}・夥伴`, textStyle(26)).setOrigin(0.5);
    this.header = this.add.text(W / 2, 76, '', textStyle(15, '#6b5530')).setOrigin(0.5);

    this.add.text(330, 108, '— 我的夥伴（點職位指派，同職位只能一人）—', textStyle(16)).setOrigin(0.5);
    this.add.text(960, 108, '— 本港可結識的夥伴 —', textStyle(16)).setOrigin(0.5);

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
        if (active) btn.setAlpha(0.7);
        this.dyn.push(btn);
      });
      // 解除職位
      const off = makeButton(this, 110 + def.roles.length * 132, y + 42, 90, 36, '不指派', () => this.assign(m.id, null), 12);
      this.dyn.push(off);
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
      this.dyn.push(this.add.text(680, y, `${def.name} ★${def.star}（${def.from}）`, textStyle(17)));
      this.dyn.push(this.add.text(680, y + 26, def.desc, { ...textStyle(12, '#5a4a30'), wordWrap: { width: 410, useAdvancedWrap: true } }));
      this.dyn.push(this.add.text(680, y + 54, `可任：${roleNames}｜${def.questTitle}`, { ...textStyle(13, status.ok ? '#6b5530' : '#9a4a2a'), wordWrap: { width: 430, useAdvancedWrap: true } }));
      const label = status.ok ? (def.fee > 0 ? `結識 ${def.fee}兩` : '邀請加入') : '查看條件';
      const btn = makeButton(this, 1130, y + 34, 150, 42, label, () => {
        if (status.ok) this.recruit(def.id);
        else this.showRequirement(def.id);
      }, 13);
      if (!status.ok) btn.setAlpha(0.78);
      this.dyn.push(btn);
    });
    if (candidatePages > 1) {
      this.dyn.push(makeButton(this, 870, 620, 120, 34, '上一頁', () => { this.candidatePage = Math.max(0, this.candidatePage - 1); this.rebuild(); }, 13));
      this.dyn.push(this.add.text(960, 620, `${this.candidatePage + 1}/${candidatePages}`, textStyle(14)).setOrigin(0.5));
      this.dyn.push(makeButton(this, 1050, 620, 120, 34, '下一頁', () => { this.candidatePage = Math.min(candidatePages - 1, this.candidatePage + 1); this.rebuild(); }, 13));
    }
  }

  private recruit(id: string): void {
    const s = this.state;
    const def = mateDefById(id);
    if (!def) return;
    const status = mateRequirementStatus(s, def);
    if (!status.ok) {
      this.showRequirement(id);
      return;
    }
    if (s.gold < def.fee) {
      toast(this, '資金不足，付不出謝禮！');
      return;
    }
    s.gold -= def.fee;
    s.mates.push({ id, role: def.roles[0] });
    this.assignRole(id, def.roles[0]); // 預設指派並處理互斥
    const unlocked = unlockCodex(s, [mateCodexId(id)]);
    saveGame(s);
    this.rebuild();
    toast(this, `${def.name} 加入了船隊，擔任${roleName(def.roles[0])}${unlocked.length ? '，人物圖鑑已解鎖' : ''}！`);
  }

  private showRequirement(id: string): void {
    const def = mateDefById(id);
    if (!def) return;
    const status = mateRequirementStatus(this.state, def);
    showModal(
      this,
      def.questTitle,
      `${def.name}（${def.history}）\n\n${def.desc}\n\n加入條件：\n${status.lines.map((line) => `・${line}`).join('\n')}`,
      [{ label: '知道了', onPick: () => {} }]
    );
  }

  private assign(mateId: string, roleKey: string | null): void {
    this.assignRole(mateId, roleKey);
    saveGame(this.state);
    this.rebuild();
    if (roleKey) toast(this, `指派為${roleName(roleKey)}！`);
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
