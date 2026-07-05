import Phaser from 'phaser';
import {
  GameState, PORTS, GOODS, Port, saveGame, dateText, rumorTexts,
  hullMax, supplyMax, crewMax, questOffersForPort, sailableDays,
  currentStoryChapter, storyAdvanceCheck, storyChapterTeaser, storyTargetPort, storyRequirementText, storyStageProgressText,
  questProgressText, questTitle, explorationPointById, unlockCodex, Quest,
  addXp, levelUpMessage, addReputation, addFriendship, updateQuestProgress,
} from '../state';
import { BASE_W, BASE_H, textStyle, makeButton, drawPanel, toast, showModal, flashFx } from '../ui';
import { audio, townBgmForRegion } from '../audio';

type FacilityType = 'tavern' | 'inn' | 'harbor' | 'office';

const FOOD_PRICE = 2;
const WATER_PRICE = 1;
const CREW_PRICE = 5;
const INN_DAY_PRICE = 100;

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
    const W = BASE_W;
    const H = BASE_H;
    audio.playBgm(townBgmForRegion(this.port.region));
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a4a);

    const titles: Record<FacilityType, string> = {
      tavern: '酒館',
      inn: '旅館',
      harbor: '港口',
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
      `${dateText(s.day)}　資金 ${s.gold} 兩　糧 ${s.food}/${supplyMax(s)}　水 ${s.water}/${supplyMax(s)}　船體 ${s.ship.hull}/${hullMax(s)}　水手 ${s.crew}/${crewMax(s)}　疲勞 ${s.fatigue}/100`
    );
  }

  private buildContent(): void {
    const W = BASE_W;
    this.refreshInfo();
    const s = this.state;

    switch (this.type) {
      case 'tavern': {
        const rumors = rumorTexts(s).map((r) => `🍺 ${r}`).join('\n');
        this.body.setText(
          `老闆娘端來一杯熱茶：「客人，聽聽最近的消息吧——」\n\n${rumors}\n\n碼頭邊有不少想出海討生活的人，每人雇用費 ${CREW_PRICE} 兩（生力軍加入，全隊疲勞也會跟著降）。\n請大家喝一輪酒（每人 1 兩），疲勞 -30！`
        );
        makeButton(this, W / 2 - 240, 510, 210, 50, `雇水手 +1（${CREW_PRICE} 兩）`, () => this.hireCrew(1), 16);
        makeButton(this, W / 2, 510, 210, 50, `雇水手 +5（${CREW_PRICE * 5} 兩）`, () => this.hireCrew(5), 16);
        makeButton(this, W / 2 + 240, 510, 210, 50, '請大家喝一輪酒', () => this.buyRound(), 16);
        makeButton(this, W / 2, 580, 320, 50, '結識夥伴（招募・指派職位）', () => {
          saveGame(s);
          this.scene.start('Mates', { portId: this.port.id, door: this.door });
        }, 16);
        break;
      }

      case 'inn': {
        this.body.setText(
          `掌櫃笑著迎上來：「客倌，住下來歇歇吧。一天 ${INN_DAY_PRICE} 兩，可以讓時間往前走，也方便等待造船廠完工。休息後疲勞歸零，船員也會順手保養旗艦。」\n\n選擇逗留天數後會自動存檔。`
        );
        makeButton(this, W / 2 - 270, 420, 190, 52, `逗留 1 天（${INN_DAY_PRICE} 兩）`, () => this.stayAtInn(1), 15);
        makeButton(this, W / 2 - 90, 420, 170, 52, `3 天（${INN_DAY_PRICE * 3} 兩）`, () => this.stayAtInn(3), 15);
        makeButton(this, W / 2 + 90, 420, 170, 52, `7 天（${INN_DAY_PRICE * 7} 兩）`, () => this.stayAtInn(7), 15);
        makeButton(this, W / 2 + 270, 420, 170, 52, `30 天（${INN_DAY_PRICE * 30} 兩）`, () => this.stayAtInn(30), 15);
        break;
      }

      case 'harbor': {
        this.body.setText(
          `港務官攤開帳本：「歡迎來到${this.port.name}！出海前記得補給——糧食一單位 ${FOOD_PRICE} 兩、清水一單位 ${WATER_PRICE} 兩。準備好了就從這裡啟航吧。」\n\n（小知識：大航海時代的船員最怕缺糧缺水，長期吃不到新鮮蔬果會得壞血病！）`
        );
        makeButton(this, W / 2 - 240, 430, 220, 50, `糧食 +10（${FOOD_PRICE * 10} 兩）`, () => {
          this.buySupply('food', 10);
        });
        makeButton(this, W / 2, 430, 220, 50, `清水 +10（${WATER_PRICE * 10} 兩）`, () => {
          this.buySupply('water', 10);
        });
        makeButton(this, W / 2 + 240, 430, 220, 50, '糧水全部補滿', () => {
          const needF = supplyMax(s) - s.food;
          const needW = supplyMax(s) - s.water;
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
          s.food = supplyMax(s);
          s.water = supplyMax(s);
          this.refreshInfo();
          toast(this, `補滿了！花費 ${cost} 兩`);
        });
        // 出航：整併自原棧橋，玩家在港口直接啟航最直覺
        makeButton(this, W / 2, 540, 380, 64, '⚓ 啟 航 出 海 ', () => {
          const days = sailableDays(s);
          if (days <= 1) {
            this.confirmLowSupply();
            return;
          }
          saveGame(s);
          this.scene.start('WorldMap');
        }, 24);
        break;
      }

      case 'office': {
        this.buildOffice();
        break;
      }
    }
  }

  /** 補給不足仍想出航時的提醒（仍可選擇硬出航） */
  private confirmLowSupply(): void {
    const s = this.state;
    showModal(
      this,
      '糧水快用完了！',
      `現在的補給大概只夠航行 ${sailableDays(s)} 天，恐怕撐不到下一個港口，半路可能會鬧饑荒。\n\n要先留下來補給，還是硬著頭皮出航？`,
      [
        { label: '先留下來補給', onPick: () => {} },
        {
          label: '沒關係，啟航！',
          onPick: () => {
            saveGame(s);
            this.scene.start('WorldMap');
          },
        },
      ]
    );
  }

  /** 官府／商館：港口介紹＋運送委託 */
  private buildOffice(): void {
    const W = BASE_W;
    const s = this.state;
    const head = this.port.culture === 'han' ? '官爺' : '商館長';

    // 逾期失敗檢查
    if (s.quest && s.day > s.quest.deadlineDay) {
      s.quest = null;
      toast(this, '上一件委託超過期限，已經失效了……');
    }

    const chapter = currentStoryChapter(s);
    const targetPort = storyTargetPort(chapter);
    if (chapter && chapter.targetPortId === this.port.id) {
      const teaser = storyChapterTeaser(s.story.heroId, chapter.chapter);
      const stageProgress = storyStageProgressText(s, chapter);
      this.body.setText(
        `【主線第 ${chapter.chapter} 章：${chapter.title}】\n` +
        `年份：${chapter.year}　人物：${chapter.npc}\n\n` +
        `${teaser}\n\n目標：${chapter.objective}\n${storyRequirementText(chapter)}${stageProgress ? `\n${stageProgress}` : ''}`
      );
      makeButton(this, W / 2, 520, 340, 52, '推進主線（看劇情）', () => {
        const check = storyAdvanceCheck(s, this.port);
        if (!check.ok) {
          showModal(this, chapter.title, check.message, [{ label: '知道了', onPick: () => {} }]);
          return;
        }
        // 播放完整對話，播完由 StoryScene 結算獎勵與圖鑑
        this.scene.start('Story', {
          mode: 'story',
          heroId: s.story.heroId,
          chapter: chapter.chapter,
          ret: { scene: 'Facility', portId: this.port.id, type: this.type, door: this.door },
        });
      });
      return;
    }

    if (!s.quest) {
      const offers = questOffersForPort(s, this.port);
      const storyHint = chapter && targetPort
        ? `\n\n目前主線：第 ${chapter.chapter} 章「${chapter.title}」；請前往【${targetPort.name}】。`
        : '\n\n這條主線已全部完成，仍可繼續自由貿易、探索與接委託。';
      this.body.setText(
        `${head}放下文書：「${this.port.desc}」\n\n今日有三件委託可選：\n\n` +
        offers.map((offer, i) => `${i + 1}. ${this.offerSummary(offer)}`).join('\n') +
        storyHint
      );
      offers.forEach((offer, i) => {
        makeButton(this, W / 2, 470 + i * 55, 430, 44, `接受：${questTitle(offer)}`, () => {
          this.acceptQuest(offer);
        }, 15);
      });
      return;
    }

    const q = s.quest;
    if (q.type === 'delivery' && q.portId === this.port.id) {
      const good = GOODS.find((g) => g.id === q.goodId)!;
      const have = s.cargo[q.goodId] ?? 0;
      if (have >= q.qty) {
        this.body.setText(`${head}清點貨物：「【${good.name}×${q.qty}】一件不少，辛苦了！這是說好的 ${q.reward} 兩。」`);
        makeButton(this, W / 2, 520, 300, 52, `交付貨物（領 ${q.reward} 兩）`, () => {
          s.cargo[q.goodId] = have - q.qty;
          const basis = s.costBasis[q.goodId] ?? 0;
          s.costBasis[q.goodId] = Math.round(basis * ((have - q.qty) / have));
          if (s.cargo[q.goodId] === 0) {
            delete s.cargo[q.goodId];
            delete s.costBasis[q.goodId];
          }
          s.gold += q.reward;
          s.quest = null;
          const lv = levelUpMessage(addXp(s, 60));
          const gains = [
            addReputation(s, 'trade', 5),
            ['tayouan', 'ponkan'].includes(this.port.id) ? addFriendship(s, 'sinckan', 3) : '',
            ...updateQuestProgress(s),
          ].filter(Boolean);
          audio.playSfx('coin');
          if (lv) { audio.playSfx('levelup'); flashFx(this, 640, 130); }
          saveGame(s);
          this.refreshInfo();
          toast(this, `委託完成！獲得 ${q.reward} 兩${gains.length ? `\n${gains.join('\n')}` : ''}`);
          if (lv) toast(this, lv, 640, 130);
          this.scene.restart({ portId: this.port.id, type: this.type, door: this.door });
        });
        return;
      }
      this.body.setText(
        `${head}看了看你的貨艙：「【${good.name}】還差 ${q.qty - have} 件呢，備齊了再來吧。期限是 ${dateText(q.deadlineDay)}。」`
      );
      return;
    }

    if ((q.type === 'combat' || q.type === 'exploration') && q.originPortId === this.port.id && q.completed) {
      this.body.setText(`${head}翻開委託簿：「${questTitle(q)}已經完成了。辛苦你跑這一趟，這是說好的 ${q.reward} 兩。」`);
      makeButton(this, W / 2, 520, 300, 52, `回報委託（領 ${q.reward} 兩）`, () => {
        s.gold += q.reward;
        const unlocked = unlockCodex(s, q.codexIds);
        s.quest = null;
        const lv = levelUpMessage(addXp(s, q.type === 'combat' ? 100 : 80));
        const gains = [
          addReputation(s, q.type === 'combat' ? 'valor' : 'adventure', 5),
          ['tayouan', 'ponkan'].includes(this.port.id) ? addFriendship(s, 'sinckan', 3) : '',
          ...updateQuestProgress(s),
        ].filter(Boolean);
        audio.playSfx('coin');
        if (unlocked.length) { audio.playSfx('unlock'); flashFx(this, 640, 130); }
        if (lv) { audio.playSfx('levelup'); flashFx(this, 640, 130); }
        saveGame(s);
        this.refreshInfo();
        toast(this, `委託完成！獲得 ${q.reward} 兩${unlocked.length ? `，解鎖圖鑑：${unlocked.join('、')}` : ''}${gains.length ? `\n${gains.join('\n')}` : ''}`);
        if (lv) toast(this, lv, 640, 130);
        this.scene.restart({ portId: this.port.id, type: this.type, door: this.door });
      });
      return;
    }

    this.body.setText(
      `${head}：「${this.port.desc}」\n\n目前的委託：\n${questProgressText(s, q)}`
    );
    makeButton(this, W / 2, 540, 260, 48, '放棄這件委託', () => {
      s.quest = null;
      saveGame(s);
      toast(this, '委託取消了（下次再接吧）');
      this.scene.restart({ portId: this.port.id, type: this.type, door: this.door });
    }, 17);
  }

  private offerSummary(offer: Quest): string {
    if (offer.type === 'delivery') {
      const target = PORTS.find((p) => p.id === offer.portId)!;
      const good = GOODS.find((g) => g.id === offer.goodId)!;
      return `採購｜${good.name}×${offer.qty} → ${target.name}｜期限 ${dateText(offer.deadlineDay)}｜${offer.reward} 兩`;
    }
    if (offer.type === 'combat') {
      return `海戰｜${offer.title}｜期限 ${dateText(offer.deadlineDay)}｜${offer.reward} 兩`;
    }
    const point = explorationPointById(offer.pointId);
    return `探險｜調查${point?.name ?? offer.pointId}｜期限 ${dateText(offer.deadlineDay)}｜${offer.reward} 兩`;
  }

  private acceptQuest(offer: Quest): void {
    const s = this.state;
    s.quest = { ...offer };
    saveGame(s);
    this.refreshInfo();
    const msg = offer.type === 'delivery'
      ? '接下採購委託了！備齊貨物送到目的地的官府／商館吧'
      : offer.type === 'combat'
        ? '接下海戰委託了！到大海上尋找骷髏標記。'
        : '接下探險委託了！到世界地圖尋找探索點。';
    toast(this, msg);
    this.scene.restart({ portId: this.port.id, type: this.type, door: this.door });
  }

  private hireCrew(n: number): void {
    const s = this.state;
    const can = Math.min(n, crewMax(s) - s.crew, Math.floor(s.gold / CREW_PRICE));
    if (can <= 0) {
      toast(this, s.crew >= crewMax(s) ? '船上已經滿員了！' : '資金不足！');
      return;
    }
    s.gold -= can * CREW_PRICE;
    // 生力軍稀釋全隊疲勞（老闆設計）：新疲勞 = 舊疲勞 × 舊人數 ÷ 新人數
    const before = s.crew;
    s.crew += can;
    s.fatigue = Math.round((s.fatigue * before) / s.crew);
    this.refreshInfo();
    toast(this, `雇了 ${can} 名水手！精神飽滿的新人讓全隊疲勞降到 ${s.fatigue}`);
  }

  /** 請水手喝一輪酒：每人 1 兩，疲勞 -30 */
  private buyRound(): void {
    const s = this.state;
    const cost = s.crew;
    if (s.fatigue <= 0) {
      toast(this, '大家精神好得很，不用喝啦！');
      return;
    }
    if (s.gold < cost) {
      toast(this, `請 ${s.crew} 個人喝要 ${cost} 兩，資金不足！`);
      return;
    }
    s.gold -= cost;
    s.fatigue = Math.max(0, s.fatigue - 30);
    this.refreshInfo();
    toast(this, `乾杯——！大家精神都來了（疲勞 -30，花費 ${cost} 兩）`);
  }

  private stayAtInn(days: number): void {
    const s = this.state;
    const cost = days * INN_DAY_PRICE;
    if (s.gold < cost) {
      toast(this, `逗留 ${days} 天需要 ${cost} 兩，資金不足！`);
      return;
    }
    s.gold -= cost;
    s.day += days;
    s.fatigue = 0;
    s.ship.hull = Math.min(hullMax(s), s.ship.hull + 3 * days);
    saveGame(s);
    this.refreshInfo();
    toast(this, `逗留 ${days} 天，花費 ${cost} 兩。疲勞歸零，日期已推進。`);
  }

  private buySupply(kind: 'food' | 'water', amount: number): void {
    const s = this.state;
    const price = kind === 'food' ? FOOD_PRICE : WATER_PRICE;
    const cur = s[kind];
    const can = Math.min(amount, supplyMax(s) - cur, Math.floor(s.gold / price));
    if (can <= 0) {
      toast(this, cur >= supplyMax(s) ? '已經滿了！' : '資金不足！');
      return;
    }
    s.gold -= can * price;
    s[kind] = cur + can;
    this.refreshInfo();
    if (can < amount) toast(this, `只補了 ${can} 單位`);
  }
}
