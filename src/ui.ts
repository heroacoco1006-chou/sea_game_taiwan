import Phaser from 'phaser';
import { audio } from './audio';

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

export const FONT = '"Microsoft JhengHei", "Noto Sans TC", "PingFang TC", sans-serif';

/**
 * 文字繪製解析度（超取樣倍率）。Phaser 預設以 1× 繪製文字材質，遊戲又用 Scale.FIT
 * 把 1280×720 畫布放大到視窗，文字會糊。這裡以較高倍率繪製文字材質，放大後仍銳利。
 * 基準 3×，高 DPI 螢幕拉到 4×（再高記憶體效益遞減）。整個遊戲走 textStyle() 自動受惠。
 */
export const TEXT_RES =
  typeof window !== 'undefined'
    ? Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 2)))
    : 3;

export function textStyle(size: number, color = '#3a2a14'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, resolution: TEXT_RES };
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
  // 投影
  g.fillStyle(0x140c06, 0.22);
  g.fillRoundedRect(x - 7, y - 1, w + 14, h + 14, 13);
  // 外木框（縱向漸層）
  g.fillGradientStyle(0x6a4827, 0x6a4827, 0x4a2f17, 0x4a2f17, 1);
  g.fillRoundedRect(x - 7, y - 7, w + 14, h + 14, 13);
  // 木框上緣高光細線（讓木框立體）
  g.lineStyle(1, 0x9a6f40, 0.7);
  g.strokeRoundedRect(x - 6, y - 6, w + 12, h + 12, 12);
  // 木框與紙之間的深色凹槽，邊界更俐落
  g.lineStyle(1, 0x2c1b0d, 0.85);
  g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 8);
  // 羊皮紙底（上亮下暗）
  g.fillGradientStyle(0xefe3c0, 0xefe3c0, COLORS.parchmentDark, COLORS.parchmentDark, 1);
  g.fillRoundedRect(x, y, w, h, 7);
  // 內框雙線（深＋淺）做出細緻凹線
  g.lineStyle(1, 0xb59a5f, 0.55);
  g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, 5);
  g.lineStyle(1, 0xfdf6e0, 0.4);
  g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 5);
  // 四角鉚釘（深底＋高光點，立體）
  const studR = 3.5;
  const inset = 17;
  for (const [sx, sy] of [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [x + inset, y + h - inset],
    [x + w - inset, y + h - inset],
  ]) {
    g.fillStyle(0x2c1b0d, 0.9);
    g.fillCircle(sx, sy, studR);
    g.fillStyle(0xc9a86a, 0.9);
    g.fillCircle(sx - 1, sy - 1, 1.2);
  }
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
    // 投影：木框下方一抹深色，增加立體感
    bg.fillStyle(0x1c1108, 0.28);
    bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 9);
    // 木框：上淺下深的縱向漸層
    bg.fillGradientStyle(
      hover ? 0x8a5e36 : COLORS.woodLight,
      hover ? 0x8a5e36 : COLORS.woodLight,
      COLORS.wood,
      COLORS.wood,
      1
    );
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    // 內層羊皮紙：上亮下暗的縱向漸層
    bg.fillGradientStyle(
      hover ? 0xfaf1d8 : 0xf0e3bd,
      hover ? 0xfaf1d8 : 0xf0e3bd,
      hover ? 0xe5d3a4 : COLORS.parchmentDark,
      hover ? 0xe5d3a4 : COLORS.parchmentDark,
      1
    );
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 7);
    // 頂部高光細線，讓立體感更明顯
    bg.lineStyle(1.5, 0xfdf6e0, hover ? 0.85 : 0.6);
    bg.beginPath();
    bg.moveTo(-w / 2 + 9, -h / 2 + 5);
    bg.lineTo(w / 2 - 9, -h / 2 + 5);
    bg.strokePath();
    // hover 時加一圈金邊
    if (hover) {
      bg.lineStyle(2, COLORS.gold, 0.9);
      bg.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 7);
    }
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
  c.on('pointerout', () => { draw(false); c.setScale(1); });
  c.on('pointerdown', () => {
    audio.playSfx('click');
    // 按下回饋：快速縮一下再彈回
    scene.tweens.add({ targets: c, scale: 0.95, duration: 70, yoyo: true });
    onClick();
  });
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
  // 進場：輕微淡入＋放大
  container.setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, duration: 140, ease: 'Quad.easeOut' });

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
