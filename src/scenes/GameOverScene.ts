import Phaser from 'phaser';
import { loadGame, saveGame, hasSave, hasAnySave, hasPortSnapshot, loadPortSnapshot } from '../state';
import { BASE_W, BASE_H, textStyle, makeButton, drawPanel } from '../ui';

/** 水手全滅：可從上次存檔點或最近一次進港安全快照繼續（教育：航海是高風險的事業） */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const W = BASE_W;
    const H = BASE_H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x101820);

    drawPanel(this, W / 2 - 360, 110, 720, 290);
    this.add.text(W / 2, 168, '船員全數倒下……', textStyle(40)).setOrigin(0.5);
    this.add
      .text(
        W / 2,
        262,
        '沒有了水手，船像片落葉在海上漂流。\n\n大航海時代的遠航就是這麼危險——\n計算好補給、讓船員好好休息，是船長最重要的責任。',
        { ...textStyle(19), align: 'center', lineSpacing: 8 }
      )
      .setOrigin(0.5);

    let btnY = 456;
    if (hasPortSnapshot()) {
      makeButton(this, W / 2, btnY, 360, 52, '回到上次進港時重整出發', () => {
        const s = loadPortSnapshot();
        if (s) {
          saveGame(s);
          this.registry.set('state', s);
          this.scene.start('WorldMap');
        }
      }, 17);
      btnY += 62;
    }
    if (hasSave()) {
      makeButton(this, W / 2, btnY, 360, 52, '從上次存檔點繼續', () => {
        const s = loadGame();
        if (s) {
          this.registry.set('state', s);
          this.scene.start('WorldMap');
        }
      }, 17);
      btnY += 62;
    }
    if (hasAnySave()) {
      makeButton(this, W / 2, btnY, 360, 52, '讀取其他存檔', () => {
        this.scene.start('SaveSlot', { mode: 'load', ret: { scene: 'Title' } });
      }, 17);
      btnY += 62;
    }
    makeButton(this, W / 2, btnY, 360, 52, '回到標題畫面', () => {
      this.scene.start('Title');
    }, 17);
  }
}
