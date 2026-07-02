import Phaser from 'phaser';
import {
  GameState, WEAPONS, ARMORS, ACCESSORIES, FIGUREHEADS, CONSUMABLES,
  cargoCount, cargoMax, supplyMax, crewMax, fleetMinCrew, fleetShips,
  shipTypeById, shipTypeOf, itemNameById, saveGame, statusSummary, useConsumable,
  heroDefById, currentStoryChapter, storyTargetPort, storyRequirementText,
  dateText, MATE_DEFS, ROLES, mateDefById, roleName, questProgressText,
  itemDescById, isTreasureItem, itemSellValueById, sellInventoryItem,
  CODEX_CATEGORIES, CodexListEntry, codexEntriesForCategory, firstUnlockedCodexCategory,
  codexCollection, codexTitle,
  STAT_KEYS, STAT_NAMES, fleetStat, mateStats, xpProgressText,
  REP_NAMES, RepKind, repLevelDesc, FACTION_NAMES,
  mateQuestStageStatuses, mateNextStepText, updateMateQuestProgress,
} from '../state';
import { codexIllustrationKey, shipCardKey, shipEquipmentKey } from '../art';
import { audio, townBgmForRegion } from '../audio';
import { PORTS } from '../state';
import { BASE_W, BASE_H, COLORS, textStyle, makeButton, drawPanel, toast, selectionRing } from '../ui';

type ReturnTarget = 'WorldMap' | 'Port';
type EquipCat = 'weapon' | 'armor' | 'accessory';
type InfoTab = 'quest' | 'equipment' | 'backpack' | 'character' | 'fleet' | 'codex';

const TABS: Array<{ key: InfoTab; label: string }> = [
  { key: 'quest', label: '任務' },
  { key: 'equipment', label: '裝備' },
  { key: 'backpack', label: '背包' },
  { key: 'character', label: '人物資訊' },
  { key: 'fleet', label: '船隊資訊' },
  { key: 'codex', label: '圖鑑' },
];

/** 六圍能力的小圖示（M5-6c）：統率／砲術／武勇／航海／知識／交涉。 */
const STAT_ICON: Record<string, string> = {
  lead: '🎖', gun: '💥', val: '⚔', nav: '🧭', kno: '📚', neg: '🤝',
};

export default class InfoScene extends Phaser.Scene {
  private from: ReturnTarget = 'WorldMap';
  private portId?: string;
  private spawn?: { x: number; y: number };
  private tab: InfoTab = 'quest';
  private codexCategory = '';
  private codexId?: string;
  private codexPage = 0;
  private codexDetailPage = 0;
  private codexDetailOpen = false;
  private dyn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Info');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { from?: ReturnTarget; portId?: string; spawn?: { x: number; y: number } }): void {
    this.from = data.from ?? 'WorldMap';
    this.portId = data.portId;
    this.spawn = data.spawn;
    this.tab = 'quest';
    this.codexCategory = '';
    this.codexId = undefined;
    this.codexPage = 0;
    this.codexDetailPage = 0;
    this.codexDetailOpen = false;
    this.dyn = [];
  }

  create(): void {
    const bgmPort = this.from === 'Port' && this.portId ? PORTS.find((p) => p.id === this.portId) : undefined;
    audio.playBgm(bgmPort ? townBgmForRegion(bgmPort.region) : 'sailing');
    const W = BASE_W;
    const H = BASE_H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);
    drawPanel(this, 24, 16, W - 48, H - 32);
    this.add.text(W / 2, 42, '資訊選單', textStyle(26)).setOrigin(0.5);

    makeButton(this, W - 145, H - 44, 220, 46, '離開（回到遊戲）', () => {
      saveGame(this.state);
      if (this.from === 'Port' && this.portId) {
        this.scene.start('Port', { portId: this.portId, spawn: this.spawn });
      } else {
        this.scene.start('WorldMap');
      }
    });

    // 存檔到指定格：玩家可把目前進度存到 10 格的任一格（方便分開測試三位主角）
    makeButton(this, 190, H - 44, 220, 46, '存檔到…（選位置）', () => {
      saveGame(this.state);
      this.scene.start('SaveSlot', {
        mode: 'save',
        ret: { scene: this.from, portId: this.portId, spawn: this.spawn },
      });
    });

    // 設定（音量／靜音／音樂版權）：覆蓋式開啟，關閉後原樣返回本選單
    makeButton(this, W / 2, H - 44, 160, 46, '設定／音量', () => {
      this.scene.launch('Settings', { caller: 'Info' });
      this.scene.pause();
    });

    this.render();
  }

  private render(): void {
    for (const obj of this.dyn) obj.destroy();
    this.dyn = [];

    this.dyn.push(this.add.rectangle(145, 370, 190, 560, COLORS.parchmentDark, 0.5));
    TABS.forEach((tab, i) => {
      const y = 118 + i * 62;
      const btn = makeButton(this, 145, y, 150, 46, tab.label, () => {
        this.tab = tab.key;
        this.render();
      }, 17);
      if (tab.key === this.tab) {
        this.dyn.push(selectionRing(this, 145, y, 150, 46));
      } else {
        btn.setAlpha(0.72);
      }
      this.dyn.push(btn);
    });

    this.dyn.push(this.add.rectangle(730, 370, 930, 560, COLORS.parchmentDark, 0.38));
    switch (this.tab) {
      case 'quest':
        this.drawQuest();
        break;
      case 'equipment':
        this.drawEquipment();
        break;
      case 'backpack':
        this.drawBackpack();
        break;
      case 'character':
        this.drawCharacter();
        break;
      case 'fleet':
        this.drawFleet();
        break;
      case 'codex':
        this.drawCodex();
        break;
    }
  }

  private addTitle(text: string): void {
    this.dyn.push(this.add.text(730, 88, text, textStyle(23)).setOrigin(0.5));
  }

  private addWrapped(x: number, y: number, text: string, width = 860, size = 16, color = '#3a2a14'): void {
    this.dyn.push(this.add.text(x, y, text, { ...textStyle(size, color), wordWrap: { width }, lineSpacing: 6 }));
  }

  private drawQuest(): void {
    this.addTitle('任務');
    const s = this.state;
    const chapter = currentStoryChapter(s);
    const target = storyTargetPort(chapter);
    const storyText = chapter
      ? `🎯 主線第 ${chapter.chapter} 章：${chapter.title}\n📍 目標港口：${target?.name ?? chapter.targetPortId}\n📜 任務內容：${chapter.objective}\n${storyRequirementText(chapter)}`
      : '🎯 目前可玩的主線章節已完成，後續 M4 會繼續擴充。';
    this.addWrapped(290, 130, storyText, 840, 17);

    if (s.quest) {
      this.addWrapped(
        290,
        310,
        `📜 支線委託　${questProgressText(s, s.quest)}`,
        840,
        16,
        '#5a4a30'
      );
    } else {
      this.addWrapped(290, 310, '📜 目前沒有接支線委託。可到官府／商館接運貨任務。', 840, 16, '#5a4a30');
    }

    // 夥伴任務日誌：進行中的專屬任務，附所在港與下一步提示
    updateMateQuestProgress(s);
    const activeQuests = Object.entries(s.mateQuests ?? {})
      .filter(([, prog]) => prog.status === 'active')
      .map(([mateId]) => mateDefById(mateId))
      .filter((def): def is NonNullable<typeof def> => !!def && !s.mates.some((m) => m.id === def.id));
    const questLines = activeQuests.map((def) => {
      const stages = mateQuestStageStatuses(s, def);
      const doneCount = stages.filter((st) => st.ok).length;
      const port = PORTS.find((p) => p.id === def.portId);
      const next = mateNextStepText(s, def);
      const tip = next ? `下一步：${next}` : `✅ 條件齊了！回【${port?.name ?? def.portId}】的酒館邀請入隊`;
      return `🧭 ${def.name}「${def.questTitle}」進度 ${doneCount}/${stages.length}（所在港：${port?.name ?? def.portId}）\n　　${tip}`;
    });
    this.addWrapped(
      290,
      420,
      questLines.length
        ? `— 夥伴專屬任務 —\n${questLines.join('\n')}`
        : '— 夥伴專屬任務 —\n目前沒有進行中的夥伴任務。到各港酒館找夥伴「接任務」吧。',
      840,
      15,
      '#5a4a30'
    );
  }

  private drawEquipment(): void {
    this.addTitle('裝備');
    const s = this.state;
    this.addWrapped(
      290,
      116,
      `目前裝備：武器 ${s.equip.weapon ? itemNameById(s.equip.weapon) : '（無）'}　防具 ${s.equip.armor ? itemNameById(s.equip.armor) : '（無）'}　飾品 ${s.equip.accessory ? itemNameById(s.equip.accessory) : '（無）'}\n船首像與船隻裝備請到造船廠的「船艦改造」。`,
      840,
      15,
      '#5a4a30'
    );
    this.drawEquipColumn('weapon', '武器', 410, 230, WEAPONS.map((x) => ({ id: x.id, label: `${x.name} 接舷+${x.board}` })));
    this.drawEquipColumn('armor', '防具', 710, 230, ARMORS.map((x) => ({ id: x.id, label: `${x.name} 防禦+${x.defense}` })));
    this.drawEquipColumn('accessory', '飾品', 1010, 230, ACCESSORIES.map((x) => ({ id: x.id, label: x.name })));
  }

  private drawEquipColumn(cat: EquipCat, title: string, x: number, y: number, rows: Array<{ id: string; label: string }>): void {
    const current = this.state.equip[cat];
    this.dyn.push(this.add.text(x, y - 42, `— ${title} —`, textStyle(19)).setOrigin(0.5));
    const off = makeButton(this, x, y - 10, 220, 34, current ? '卸下目前裝備' : '目前未裝備', () => this.equip(cat, null), 13);
    off.setAlpha(current ? 1 : 0.45);
    this.dyn.push(off);

    rows.forEach((row, i) => {
      const own = this.state.inventory[row.id] ?? 0;
      const equipped = current === row.id;
      const label = own > 0 ? `${equipped ? '✓ ' : ''}${row.label}` : `${row.label}（未持有）`;
      const btn = makeButton(this, x, y + 34 + i * 42, 255, 34, label, () => this.equip(cat, row.id), 12);
      btn.setAlpha(own > 0 ? 1 : 0.45);
      this.dyn.push(btn);
    });
  }

  private drawBackpack(): void {
    this.addTitle('背包');
    this.addWrapped(290, 112, '背包列出沒有被裝備的個人道具、未裝在旗艦上的船首像、可使用的消耗道具，以及探險找到的寶物。', 840, 15, '#5a4a30');

    const entries = this.backpackEntries();
    if (entries.length === 0) {
      this.addWrapped(300, 170, '背包目前是空的。', 840, 17);
    }
    entries.forEach((entry, i) => {
      const y = 170 + i * 44;
      const item = CONSUMABLES.find((x) => x.id === entry.id);
      const desc = itemDescById(entry.id);
      this.addWrapped(300, y, `${itemNameById(entry.id)} x${entry.qty}${desc ? `：${desc}` : ''}`, 600, 15);
      if (item) {
        const btn = makeButton(this, 1035, y + 10, 140, 34, '使用', () => this.useItem(item.id), 14);
        this.dyn.push(btn);
      } else if (isTreasureItem(entry.id)) {
        const value = itemSellValueById(entry.id);
        const btn = makeButton(this, 1035, y + 10, 150, 34, `賣出 ${value}兩`, () => this.sellItem(entry.id), 13);
        this.dyn.push(btn);
      }
    });
  }

  private backpackEntries(): Array<{ id: string; qty: number }> {
    const equipped = [
      this.state.equip.weapon, this.state.equip.armor, this.state.equip.accessory,
      this.state.ship.figurehead, this.state.ship.armor, this.state.ship.sail, this.state.ship.cannonType,
    ].filter(Boolean) as string[];
    const used = new Map<string, number>();
    equipped.forEach((id) => used.set(id, (used.get(id) ?? 0) + 1));
    return Object.entries(this.state.inventory)
      .map(([id, qty]) => ({ id, qty: qty - (used.get(id) ?? 0) }))
      .filter((entry) => entry.qty > 0);
  }

  private drawCharacter(): void {
    this.addTitle('人物資訊');
    const s = this.state;
    const hero = heroDefById(s.story.heroId);
    const statLine = STAT_KEYS.map((k) => {
      const base = s.captain.stats[k];
      const eff = fleetStat(s, k);
      return `${STAT_ICON[k]}${STAT_NAMES[k]} ${base}${eff > base ? `(隊${eff})` : ''}`;
    }).join('　');
    const lines = [
      `${hero.name}（${hero.role}）　${xpProgressText(s)}`,
      hero.intro,
      `目前日期：${dateText(s.day)}　資金：${s.gold} 兩`,
      `水手：${s.crew}/${crewMax(s)}　疲勞：${s.fatigue}/100　海上狀態：${statusSummary(s)}`,
      `能力（括號為含在隊夥伴加成）：\n${statLine}`,
      `聲望：\n${(['adventure', 'trade', 'valor'] as RepKind[])
        .map((k) => `⚑${REP_NAMES[k]} ${s.reputation?.[k] ?? 0}——${repLevelDesc(k, s.reputation?.[k] ?? 0)}`)
        .join('\n')}`,
      ...Object.entries(s.friendship ?? {})
        .filter(([, v]) => v > 0)
        .map(([fid, v]) => `💛${FACTION_NAMES[fid] ?? fid}友好度 ${v}`),
      `主線方向：${hero.routeFocus}`,
      `已招募夥伴：${s.mates.length} 位`,
      `圖鑑收集：${codexCollection(s).unlocked}/${codexCollection(s).total}（${codexCollection(s).rate}%）　稱號：${codexTitle(s)}`,
    ];
    this.addWrapped(300, 124, lines.join('\n'), 840, 16);
  }

  private drawFleet(): void {
    this.addTitle('船隊資訊');
    const s = this.state;
    const flag = shipTypeOf(s);
    const figurehead = FIGUREHEADS.find((x) => x.id === s.ship.figurehead);
    const cardKey = this.m5Texture(shipCardKey(flag.id), '');
    if (cardKey) {
      const card = this.add.image(1015, 215, cardKey).setDisplaySize(150, 200);
      this.dyn.push(card);
      this.dyn.push(this.add.text(1015, 328, flag.name, textStyle(13, '#5a4a30')).setOrigin(0.5));
    }
    this.drawShipEquipmentIcons(870, 360);
    this.addWrapped(
      290,
      112,
      `艦隊 ${fleetShips(s).length}/5 艘　貨艙 ${cargoCount(s)}/${cargoMax(s)}　糧水艙 ${supplyMax(s)}　水手 ${s.crew}/${crewMax(s)}（最低 ${fleetMinCrew(s)}）\n旗艦：${flag.name}　船體 ${s.ship.hull}/${flag.hullMax}　大砲 ${s.ship.cannons}/${flag.cannonSlots}　船首像：${figurehead?.name ?? '（無）'}`,
      cardKey ? 560 : 840,
      15
    );

    s.escorts.forEach((ship, i) => {
      const type = shipTypeById(ship.typeId);
      const y = 202 + i * 44;
      this.addWrapped(300, y, `僚艦${i + 1}：${type.name}　船體 ${ship.hull}/${type.hullMax}　艙 ${ship.cargoSpace}/${ship.supplySpace}　砲 ${ship.cannons}`, 560, 14);
      const btn = makeButton(this, 770, y + 10, 130, 34, '升為旗艦', () => this.promoteEscort(i), 14);
      this.dyn.push(btn);
    });
    if (s.escorts.length === 0) {
      this.addWrapped(300, 202, '目前沒有僚艦。可到造船廠建造船隻，完工後取船加入艦隊。', 840, 15, '#5a4a30');
    }

    this.dyn.push(this.add.text(300, 390, '— 夥伴職位 —', textStyle(18)));
    if (s.mates.length === 0) {
      this.addWrapped(300, 426, '尚未招募夥伴。可到酒館結識夥伴。', 840, 15, '#5a4a30');
      return;
    }
    s.mates.slice(0, 5).forEach((mate, i) => {
      const def = mateDefById(mate.id);
      if (!def) return;
      const y = 432 + i * 48;
      const st = mateStats(def);
      const statStr = STAT_KEYS.map((k) => `${STAT_ICON[k]}${STAT_NAMES[k]}${st[k]}`).join(' ');
      // 能力欄加寬至 420，讓六項能力一行顯示（不再折行重疊）；職位按鈕整排右移避讓
      this.addWrapped(300, y, `${def.name} ★${def.star}：${roleName(mate.role)}\n${statStr}`, 420, 12);
      def.roles.forEach((roleKey, j) => {
        const role = ROLES.find((r) => r.key === roleKey);
        const bx = 785 + j * 105;
        const btn = makeButton(this, bx, y + 10, 94, 32, mate.role === roleKey ? `✓${role?.name ?? roleKey}` : role?.name ?? roleKey, () => this.assignRole(mate.id, roleKey), 12);
        if (mate.role === roleKey) this.dyn.push(selectionRing(this, bx, y + 10, 94, 32));
        this.dyn.push(btn);
      });
      const off = makeButton(this, 785 + def.roles.length * 105, y + 10, 82, 32, '不指派', () => this.assignRole(mate.id, null), 12);
      this.dyn.push(off);
    });
  }

  private drawShipEquipmentIcons(x: number, y: number): void {
    const entries = [
      { label: '船首像', id: this.state.ship.figurehead },
      { label: '裝甲', id: this.state.ship.armor },
      { label: '船帆', id: this.state.ship.sail },
      { label: '砲種', id: this.state.ship.cannonType },
    ];
    entries.forEach((entry, i) => {
      const cx = x + i * 82;
      const frame = this.add.rectangle(cx, y, 54, 54, COLORS.parchment, 0.9).setStrokeStyle(2, COLORS.wood);
      this.dyn.push(frame);
      const key = entry.id ? this.m5Texture(shipEquipmentKey(entry.id), '') : '';
      if (key) {
        this.dyn.push(this.add.image(cx, y, key).setDisplaySize(48, 48));
      } else {
        this.dyn.push(this.add.text(cx, y, '未裝', textStyle(11, '#8a7650')).setOrigin(0.5));
      }
      this.dyn.push(this.add.text(cx, y + 36, entry.label, textStyle(11, '#5a4a30')).setOrigin(0.5));
      if (entry.id) {
        this.dyn.push(this.add.text(cx, y + 51, itemNameById(entry.id), textStyle(10, '#6b5530')).setOrigin(0.5));
      }
    });
  }

  private drawCodex(): void {
    const col = codexCollection(this.state);
    this.dyn.push(
      this.add
        .text(730, 88, `圖鑑　收集 ${col.unlocked}/${col.total}（${col.rate}%）　稱號：${codexTitle(this.state)}`, textStyle(19))
        .setOrigin(0.5)
    );
    if (!this.codexCategory) this.codexCategory = firstUnlockedCodexCategory(this.state);
    const category = CODEX_CATEGORIES.find((cat) => cat.id === this.codexCategory) ?? CODEX_CATEGORIES[0];
    if (!category) {
      this.addWrapped(300, 130, '目前沒有圖鑑資料。', 840, 17);
      return;
    }

    CODEX_CATEGORIES.forEach((cat, i) => {
      const unlockedCount = codexEntriesForCategory(this.state, cat.id).filter((entry) => entry.unlocked).length;
      const total = codexEntriesForCategory(this.state, cat.id).length;
      const btn = makeButton(this, 385 + (i % 3) * 170, 120 + Math.floor(i / 3) * 38, 158, 32, `${cat.label} ${unlockedCount}/${total}`, () => {
        this.codexCategory = cat.id;
        this.codexId = undefined;
        this.codexPage = 0;
        this.codexDetailPage = 0;
        this.codexDetailOpen = false;
        this.render();
      }, 11);
      if (cat.id === this.codexCategory) {
        this.dyn.push(selectionRing(this, 385 + (i % 3) * 170, 120 + Math.floor(i / 3) * 38, 158, 32));
      } else {
        btn.setAlpha(0.72);
      }
      this.dyn.push(btn);
    });

    this.addWrapped(300, 238, category.desc, 520, 14, '#6b5530');
    const entries = codexEntriesForCategory(this.state, category.id);
    if (entries.length === 0) {
      this.addWrapped(300, 286, '這個分類目前沒有資料。', 520, 15);
      return;
    }

    const pageSize = 12;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    this.codexPage = Math.min(this.codexPage, pageCount - 1);
    const visible = entries.slice(this.codexPage * pageSize, this.codexPage * pageSize + pageSize);
    if (this.codexId && !entries.some((entry) => entry.id === this.codexId)) {
      this.codexId = undefined;
      this.codexDetailPage = 0;
      this.codexDetailOpen = false;
    }
    visible.forEach((entry, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const label = entry.unlocked ? entry.title : '???';
      const btn = makeButton(this, 475 + col * 410, 300 + row * 44, 350, 34, label, () => {
        this.codexId = entry.id;
        this.codexDetailPage = 0;
        this.codexDetailOpen = true;
        this.render();
      }, 12);
      if (!entry.unlocked) btn.setAlpha(0.55);
      this.dyn.push(btn);
    });

    if (pageCount > 1) {
      this.dyn.push(makeButton(this, 580, 602, 110, 32, '上一頁', () => { this.codexPage = Math.max(0, this.codexPage - 1); this.codexId = undefined; this.codexDetailOpen = false; this.render(); }, 12));
      this.dyn.push(this.add.text(730, 602, `${this.codexPage + 1}/${pageCount}`, textStyle(13)).setOrigin(0.5));
      this.dyn.push(makeButton(this, 880, 602, 110, 32, '下一頁', () => { this.codexPage = Math.min(pageCount - 1, this.codexPage + 1); this.codexId = undefined; this.codexDetailOpen = false; this.render(); }, 12));
    }

    const selected = entries.find((entry) => entry.id === this.codexId);
    if (selected && this.codexDetailOpen) this.drawCodexDetail(selected);
  }

  private drawCodexDetail(selected: CodexListEntry): void {
    this.dyn.push(this.add.rectangle(730, 370, 930, 570, 0x3a2a14, 0.24));
    this.dyn.push(drawPanel(this, 285, 105, 890, 540));
    const title = selected.unlocked ? `【${selected.type}】${selected.title}` : `【${selected.type}】???`;
    const body = selected.unlocked
      ? [
          selected.short ? `摘要：${selected.short}` : '',
          selected.body,
          selected.whyImportant ? `為什麼重要：${selected.whyImportant}` : '',
          selected.kidNote ? `閱讀提示：${selected.kidNote}` : '',
        ].filter(Boolean).join('\n\n')
      : `尚未發現這筆圖鑑。\n\n提示：${selected.unlockHint ?? '繼續推進主線、探索地圖或結識夥伴，就有機會解鎖。'}`;
    const pages = this.splitCodexPages(body, selected.unlocked ? 15 : 8);
    this.codexDetailPage = Math.min(this.codexDetailPage, pages.length - 1);
    const detail = this.add.text(
      320,
      145,
      `${title}\n\n${pages[this.codexDetailPage] ?? ''}`,
      { ...textStyle(16), wordWrap: { width: 430, useAdvancedWrap: true }, lineSpacing: 8 }
    );
    this.dyn.push(detail);
    this.drawCodexIllustration(selected);
    this.dyn.push(makeButton(this, 1065, 135, 120, 34, '返回圖鑑', () => {
      this.codexDetailOpen = false;
      this.codexDetailPage = 0;
      this.render();
    }, 13));
    if (pages.length > 1) {
      this.dyn.push(makeButton(this, 600, 615, 100, 32, '上段', () => { this.codexDetailPage = Math.max(0, this.codexDetailPage - 1); this.render(); }, 12));
      this.dyn.push(this.add.text(730, 615, `${this.codexDetailPage + 1}/${pages.length}`, textStyle(13)).setOrigin(0.5));
      this.dyn.push(makeButton(this, 860, 615, 100, 32, '下段', () => { this.codexDetailPage = Math.min(pages.length - 1, this.codexDetailPage + 1); this.render(); }, 12));
    }
  }

  private drawCodexIllustration(selected: CodexListEntry): void {
    const frameX = 800;
    const frameY = 190;
    const frameW = 320;
    const frameH = 320;
    this.dyn.push(this.add.rectangle(frameX + frameW / 2, frameY + frameH / 2, frameW + 18, frameH + 18, 0x3a2a14, 0.18));
    this.dyn.push(drawPanel(this, frameX, frameY, frameW, frameH));

    if (!selected.unlocked) {
      this.dyn.push(this.add.text(frameX + frameW / 2, frameY + frameH / 2, '???', textStyle(42, '#8a7650')).setOrigin(0.5));
      return;
    }

    const key = this.m5Texture(codexIllustrationKey(selected.id), '');
    if (key) {
      this.dyn.push(this.add.image(frameX + frameW / 2, frameY + frameH / 2, key).setDisplaySize(286, 286));
    } else {
      this.dyn.push(this.add.text(frameX + frameW / 2, frameY + frameH / 2, '插圖準備中', textStyle(18, '#8a7650')).setOrigin(0.5));
    }
  }
  private splitCodexPages(text: string, maxLines: number): string[] {
    const lines = this.wrapCodexBody(text).split('\n');
    const pages: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (current.length >= maxLines && current.some((part) => part.trim())) {
        pages.push(current.join('\n').trim());
        current = line.trim() ? [line] : [];
      } else {
        current.push(line);
      }
    }
    if (current.some((line) => line.trim())) pages.push(current.join('\n').trim());
    return pages.length ? pages : [''];
  }

  private wrapCodexBody(text: string): string {
    return text
      .split('\n')
      .map((paragraph) => {
        const out: string[] = [];
        let line = '';
        for (const ch of paragraph) {
          line += ch;
          if (line.length >= 19 || '。！？；'.includes(ch)) {
            out.push(line);
            line = '';
          }
        }
        if (line) out.push(line);
        return out.join('\n');
      })
      .join('\n');
  }

  private equip(cat: EquipCat, id: string | null): void {
    if (id && (this.state.inventory[id] ?? 0) <= 0) {
      toast(this, '背包裡沒有這件道具，先到道具屋購買。');
      return;
    }
    this.state.equip[cat] = id;
    saveGame(this.state);
    this.render();
    toast(this, id ? `已裝備【${itemNameById(id)}】。` : '已卸下裝備。');
  }

  private useItem(id: string): void {
    const msg = useConsumable(this.state, id);
    saveGame(this.state);
    this.render();
    toast(this, msg);
  }

  private sellItem(id: string): void {
    const msg = sellInventoryItem(this.state, id);
    saveGame(this.state);
    this.render();
    toast(this, msg);
  }

  private promoteEscort(idx: number): void {
    const s = this.state;
    const flag = s.ship;
    const esc = s.escorts[idx];
    esc.x = flag.x;
    esc.y = flag.y;
    s.ship = esc;
    s.escorts[idx] = flag;
    saveGame(s);
    this.render();
    toast(this, `${shipTypeById(esc.typeId).name} 升為旗艦。`);
  }

  private assignRole(mateId: string, roleKey: string | null): void {
    const s = this.state;
    if (roleKey) {
      for (const mate of s.mates) {
        if (mate.role === roleKey && mate.id !== mateId) mate.role = null;
      }
    }
    const mate = s.mates.find((m) => m.id === mateId);
    if (mate) mate.role = roleKey;
    saveGame(s);
    this.render();
    toast(this, roleKey ? `已指派為${roleName(roleKey)}。` : '已取消職位。');
  }

  private m5Texture(preferred: string, fallback: string): string {
    return preferred && this.textures.exists(preferred) ? preferred : fallback;
  }
}
