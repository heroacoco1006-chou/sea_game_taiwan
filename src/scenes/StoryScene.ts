import Phaser from 'phaser';
import {
  GameState, PORTS, Port, saveGame, heroDefById, completeStoryChapter, getChapterScript,
} from '../state';
import type { ParsedChapter, StoryLine } from '../state';
import { COLORS, textStyle, makeButton, drawPanel, showModal } from '../ui';

interface ReturnTo {
  portId: string;
  type: string;
  door: { x: number; y: number };
}

/**
 * 主線劇情播放器（仿大航海2 對話框）：
 * 一句一句播放旁白／心聲／角色對白，點畫面或按 Enter 前進；
 * 遇到圖鑑解鎖會跳出說明卡；播完才結算獎勵、圖鑑與年份推進。
 */
export default class StoryScene extends Phaser.Scene {
  private heroId = 'lin';
  private chapterNo = 1;
  private ret!: ReturnTo;
  private script?: ParsedChapter;
  private index = 0;
  private heroName = '';
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private hint!: Phaser.GameObjects.Text;
  private finished = false;

  constructor() {
    super('Story');
  }

  private get state(): GameState {
    return this.registry.get('state') as GameState;
  }

  init(data: { heroId: string; chapter: number; ret: ReturnTo }): void {
    this.heroId = data.heroId;
    this.chapterNo = data.chapter;
    this.ret = data.ret;
    this.script = getChapterScript(data.heroId, data.chapter);
    this.index = 0;
    this.dyn = [];
    this.finished = false;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.heroName = heroDefById(this.heroId).name;

    // 背景：海色＋暗角，營造劇情氛圍
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.seaDeep);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35);

    // 上方章節標題列
    const title = this.script
      ? `${this.heroName}・第 ${this.chapterNo} 章　${this.script.title}（${this.script.year}）`
      : `${this.heroName}・第 ${this.chapterNo} 章`;
    this.add.text(40, 30, title, textStyle(20, '#f2e3bd')).setOrigin(0, 0.5);

    // 跳過本章（也方便重玩時快轉）
    makeButton(this, W - 90, 30, 130, 40, '跳過 ▶▶', () => this.finish(), 14).setDepth(50);

    // 下方對話框面板
    drawPanel(this, 60, 470, W - 120, 210);

    // 前進提示
    this.hint = this.add
      .text(W - 80, 660, '點畫面 / 按 Enter 繼續 ▼', textStyle(15, '#6b5530'))
      .setOrigin(1, 0.5);

    // 點對話框區域前進（避開上方按鈕）
    const advanceZone = this.add
      .rectangle(W / 2, 400, W, 600, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    advanceZone.on('pointerdown', () => this.advance());

    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());

    if (!this.script || this.script.lines.length === 0) {
      this.finish();
      return;
    }
    this.renderBeat();
  }

  private advance(): void {
    if (this.finished) return;
    this.index += 1;
    if (!this.script || this.index >= this.script.lines.length) {
      this.finish();
      return;
    }
    this.renderBeat();
  }

  private renderBeat(): void {
    for (const obj of this.dyn) obj.destroy();
    this.dyn = [];
    if (!this.script) return;
    const line = this.script.lines[this.index];
    const W = this.scale.width;

    // 進度（第幾句）
    this.dyn.push(
      this.add.text(80, 660, `${this.index + 1} / ${this.script.lines.length}`, textStyle(14, '#8a7448'))
    );

    switch (line.kind) {
      case 'scene':
        this.drawScene(line);
        break;
      case 'narration':
        this.drawNarration(line);
        break;
      case 'inner':
        this.drawInner(line);
        break;
      case 'speech':
        this.drawSpeech(line);
        break;
      case 'objective':
        this.drawObjective(line);
        break;
      case 'codex':
        this.drawCodex(line);
        break;
    }
    this.hint.setVisible(true);
    void W;
  }

  /** 對話框內的主文字（自動換行＋過長縮字） */
  private bodyText(text: string, color = '#3a2a14', size = 22, top = 512): Phaser.GameObjects.Text {
    const W = this.scale.width;
    const t = this.add.text(110, top, text, {
      ...textStyle(size, color),
      wordWrap: { width: W - 220, useAdvancedWrap: true },
      lineSpacing: 8,
    });
    while (t.height > 150 && Number.parseInt(String(t.style.fontSize), 10) > 14) {
      t.setFontSize(Number.parseInt(String(t.style.fontSize), 10) - 1);
    }
    this.dyn.push(t);
    return t;
  }

  private drawScene(line: StoryLine): void {
    const W = this.scale.width;
    this.dyn.push(this.add.text(W / 2, 500, '✦', textStyle(22, '#a8884a')).setOrigin(0.5));
    this.dyn.push(this.add.text(W / 2, 545, line.text, textStyle(24, '#5a4a30')).setOrigin(0.5));
    this.dyn.push(
      this.add.text(W / 2, 590, '（場景）', textStyle(15, '#8a7448')).setOrigin(0.5)
    );
  }

  private drawNarration(line: StoryLine): void {
    this.dyn.push(this.add.text(110, 488, '旁白', textStyle(15, '#8a7448')));
    this.bodyText(line.text, '#4a3a22', 21);
  }

  private drawInner(line: StoryLine): void {
    this.dyn.push(this.add.text(110, 488, `${this.heroName}・心聲`, textStyle(15, '#3a5a8a')));
    this.bodyText(line.text, '#2f4a6e', 21);
  }

  private drawSpeech(line: StoryLine): void {
    const speaker = line.speaker ?? '';
    const isHero = speaker === this.heroName;
    // 說話者名牌
    const plate = this.add.graphics();
    plate.fillStyle(isHero ? COLORS.gold : COLORS.woodLight, 1);
    plate.fillRoundedRect(90, 436, Math.min(360, 40 + speaker.length * 22), 38, 8);
    this.dyn.push(plate);
    this.dyn.push(this.add.text(110, 455, speaker, textStyle(20, isHero ? '#3a2a14' : '#f2e3bd')).setOrigin(0, 0.5));

    let top = 512;
    if (line.action) {
      const act = this.add.text(110, 500, `（${line.action}）`, textStyle(16, '#8a7448'));
      this.dyn.push(act);
      top = 532;
    }
    this.bodyText(`「${line.text}」`, '#3a2a14', 22, top);
  }

  private drawObjective(line: StoryLine): void {
    const W = this.scale.width;
    const box = this.add.graphics();
    box.fillStyle(COLORS.gold, 0.25);
    box.fillRoundedRect(90, 500, W - 180, 70, 8);
    box.lineStyle(2, COLORS.gold, 1);
    box.strokeRoundedRect(90, 500, W - 180, 70, 8);
    this.dyn.push(box);
    this.dyn.push(this.add.text(110, 512, '▸ 目標', textStyle(16, '#7a5230')));
    this.bodyText(line.text, '#5a4a30', 20, 534);
  }

  private drawCodex(line: StoryLine): void {
    const W = this.scale.width;
    // 圖鑑解鎖卡：金框，標題＋史實說明
    const card = this.add.graphics();
    card.fillStyle(0xfff3d6, 1);
    card.fillRoundedRect(90, 484, W - 180, 180, 10);
    card.lineStyle(3, COLORS.gold, 1);
    card.strokeRoundedRect(90, 484, W - 180, 180, 10);
    this.dyn.push(card);
    this.dyn.push(this.add.text(110, 498, `✦ 解鎖圖鑑【${line.codexTitle ?? ''}】`, textStyle(19, '#7a5230')));
    const body = this.add.text(110, 532, line.text, {
      ...textStyle(18, '#4a3a22'),
      wordWrap: { width: W - 220, useAdvancedWrap: true },
      lineSpacing: 7,
    });
    while (body.height > 120 && Number.parseInt(String(body.style.fontSize), 10) > 13) {
      body.setFontSize(Number.parseInt(String(body.style.fontSize), 10) - 1);
    }
    this.dyn.push(body);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.hint?.setVisible(false);

    const port = PORTS.find((p) => p.id === this.ret.portId) as Port;
    const result = completeStoryChapter(this.state, port);
    saveGame(this.state);

    showModal(this, result.title, result.message, [
      { label: '回到港口', onPick: () => this.scene.start('Facility', { portId: this.ret.portId, type: this.ret.type, door: this.ret.door }) },
    ]);
  }
}
