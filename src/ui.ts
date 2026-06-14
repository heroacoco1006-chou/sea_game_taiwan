import Phaser from 'phaser';

/** 仿大航海2 的羊皮紙＋木框配色 */
export const COLORS = {
  wood: 0x5b3a1e,
  woodLight: 0x7a5230,
  parchment: 0xe8d9b0,
  parchmentDark: 0xd4c190,
  ink: 0x3a2a14,
  sea: 0x1d4e6e,
  seaDeep: 0x153b54,
  land: 0xc9b178,
  landEdge: 0x8a7448,
  gold: 0xf2c14e,
};

export const FONT = '"Microsoft JhengHei", "Noto Sans TC", sans-serif';

export function textStyle(size: number, color = '#3a2a14'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color };
}

/** 木框羊皮紙面板 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.wood, 1);
  g.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 10);
  g.fillStyle(COLORS.woodLight, 1);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  g.fillStyle(COLORS.parchment, 1);
  g.fillRoundedRect(x, y, w, h, 6);
  return g;
}

/** 簡單按鈕：回傳容器，點擊時呼叫 onClick */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 20
): Phaser.GameObjects.Container {
  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(hover ? COLORS.woodLight : COLORS.wood, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.fillStyle(hover ? 0xf5ecd2 : COLORS.parchment, 1);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6);
  };
  draw(false);
  const txt = scene.add
    .text(0, 0, label, { ...textStyle(fontSize), align: 'center', wordWrap: { width: w - 14 } })
    .setOrigin(0.5);
  while ((txt.width > w - 14 || txt.height > h - 8) && fontSize > 10) {
    fontSize -= 1;
    txt.setFontSize(fontSize);
  }
  const c = scene.add.container(x, y, [bg, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', () => onClick());
  return c;
}

export interface ModalChoice {
  label: string;
  onPick: () => void;
}

/** 事件對話框（畫面置中、固定於鏡頭）：顯示文字與選項按鈕，回傳容器（選擇後自動銷毀） */
export function showModal(
  scene: Phaser.Scene,
  title: string,
  body: string,
  choices: ModalChoice[]
): Phaser.GameObjects.Container {
  const cam = scene.cameras.main;
  const w = Math.min(820, cam.width - 80);
  const buttonH = choices.length * 58;
  const h = Math.min(cam.height - 80, 220 + buttonH);
  const cx = cam.width / 2;
  const cy = cam.height / 2;

  const dim = scene.add.rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.45);
  const panel = scene.add.graphics();
  panel.fillStyle(COLORS.wood, 1);
  panel.fillRoundedRect(cx - w / 2 - 6, cy - h / 2 - 6, w + 12, h + 12, 10);
  panel.fillStyle(COLORS.parchment, 1);
  panel.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);

  const titleT = scene.add
    .text(cx, cy - h / 2 + 36, title, { ...textStyle(26), align: 'center', wordWrap: { width: w - 80 } })
    .setOrigin(0.5);
  const bodyY = cy - h / 2 + 78;
  const bodyH = h - buttonH - 112;
  const bodyT = scene.add
    .text(cx, bodyY, body, { ...textStyle(18), align: 'center', wordWrap: { width: w - 90 }, lineSpacing: 6 })
    .setOrigin(0.5, 0);
  while (bodyT.height > bodyH && Number.parseInt(String(bodyT.style.fontSize), 10) > 13) {
    const next = Number.parseInt(String(bodyT.style.fontSize), 10) - 1;
    bodyT.setFontSize(next);
  }
  let clip: Phaser.GameObjects.Graphics | null = null;
  if (bodyT.height > bodyH) {
    clip = scene.add.graphics();
    clip.fillStyle(0xffffff, 1);
    clip.fillRect(cx - w / 2 + 40, bodyY, w - 80, bodyH);
    clip.setVisible(false);
    bodyT.setMask(clip.createGeometryMask());
  }

  const parts: Phaser.GameObjects.GameObject[] = clip ? [dim, panel, titleT, bodyT, clip] : [dim, panel, titleT, bodyT];
  const container = scene.add.container(0, 0, parts);
  container.setDepth(2000);
  container.setScrollFactor(0);

  choices.forEach((c, i) => {
    const btn = makeButton(
      scene,
      cx,
      cy + h / 2 - (choices.length - i) * 58 - 2,
      Math.min(w - 160, 520),
      46,
      c.label,
      () => {
        container.destroy();
        c.onPick();
      },
      19
    );
    btn.setScrollFactor(0);
    container.add(btn);
  });
  return container;
}

/** 短暫浮現的提示訊息 */
export function toast(scene: Phaser.Scene, msg: string, x = 640, y = 80): void {
  const t = scene.add
    .text(x, y, msg, { ...textStyle(20, '#fff8e0'), backgroundColor: '#3a2a14cc', padding: { x: 14, y: 8 } })
    .setOrigin(0.5)
    .setDepth(1000);
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: y - 30,
    delay: 1100,
    duration: 500,
    onComplete: () => t.destroy(),
  });
}
