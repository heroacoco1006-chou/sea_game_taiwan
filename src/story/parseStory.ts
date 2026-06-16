// 主線劇本解析器：把 src/data/story/*.md 解析成可播放的多段對話。
// 劇本是史實校對的唯一來源（劇情文本與程式分離），程式只負責解析與播放。
import linRaw from '../data/story/lin_海商線.md?raw';
import peterRaw from '../data/story/peter_VOC線.md?raw';
import chiyoRaw from '../data/story/chiyo_朱印船線.md?raw';
import matesRaw from '../data/story/mates_夥伴任務.md?raw';

export type StoryLineKind = 'narration' | 'inner' | 'speech' | 'objective' | 'codex' | 'scene';

export interface StoryLine {
  kind: StoryLineKind;
  speaker?: string; // 角色對白的說話者
  action?: string; // 對白前的動作括註，如（笑）
  text: string; // 旁白／心聲／對白／目標／圖鑑內文
  codexTitle?: string; // 圖鑑標題
  codexId?: string; // 圖鑑解鎖用 id
}

export interface ParsedCodex {
  id: string;
  type: string;
  title: string;
  body: string;
}

export interface ParsedChapter {
  heroId: string;
  chapter: number;
  title: string;
  year: number;
  lines: StoryLine[];
  codex: ParsedCodex[];
}

const RAW: Record<string, string> = {
  lin: linRaw,
  peter: peterRaw,
  chiyo: chiyoRaw,
};

/** 依圖鑑標題粗略判斷類別（給國小生看的圖鑑分頁標籤，非嚴謹分類）。
 *  先判事件（含人名的事件如「鄭芝龍崛起」應歸事件），再判純人名。 */
function classifyCodex(title: string): string {
  if (/(事件|崛起|受撫|易代|降清|海戰|攻台|之戰|海禁|鎖國|令|驅逐|起事|威脅|霸權)/.test(title)) return '事件';
  if (/(顏思齊|鄭芝龍|鄭成功|國姓爺)/.test(title)) return '人物';
  if (/(城|那霸|出島|大員|笨港|澎湖|琉球|港)/.test(title)) return '地點';
  if (/(公司|VOC|制度|贌社|王田|貿易網|窗口)/.test(title)) return '制度';
  if (/(鹿皮|蔗糖|生絲|白銀|朱印船)/.test(title)) return '貿易品';
  return '史料';
}

/** 是否為應略過的行（標題、區隔線、進入時機、引言、下一章指標） */
function isSkippable(line: string): boolean {
  return (
    line.startsWith('#') ||
    line.startsWith('---') ||
    line.startsWith('>') ||
    line.startsWith('**') ||
    line.startsWith('→')
  );
}

/** 把一行內容轉成對話行（旁白／心聲／角色對白／目標）；不符則回 null。
 *  注意：場景（###）與圖鑑（✦）由呼叫端各自處理。 */
function contentLine(line: string): StoryLine | null {
  if (line.startsWith('▸')) {
    return { kind: 'objective', text: line.replace(/^▸\s*目標[：:]\s*/, '').replace(/^▸\s*/, '').trim() };
  }
  const tagMatch = line.match(/^〔([^〕]+)〕(.*)$/);
  if (!tagMatch) return null;
  const tag = tagMatch[1].trim();
  const rest = tagMatch[2].trim();
  if (tag === '旁白') return { kind: 'narration', text: rest };
  if (tag === '心聲') return { kind: 'inner', text: rest };
  // 角色對白：可能是（動作）「對白」或「對白」
  let action: string | undefined;
  let body = rest;
  const actionMatch = body.match(/^（([^）]*)）\s*/);
  if (actionMatch) {
    action = actionMatch[1].trim();
    body = body.slice(actionMatch[0].length).trim();
  }
  const quoteMatch = body.match(/^「([\s\S]+)」$/);
  const text = quoteMatch ? quoteMatch[1] : body.replace(/^「|」$/g, '');
  return { kind: 'speech', speaker: tag, action, text };
}

/** 場景小標 ### → StoryLine；非場景回 null */
function sceneLine(line: string): StoryLine | null {
  if (!line.startsWith('###')) return null;
  const name = line.replace(/^###\s*/, '').replace(/\s*——\s*/g, '・').replace(/・$/, '').trim();
  return name ? { kind: 'scene', text: name } : null;
}

function parseHero(heroId: string, raw: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let current: ParsedChapter | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // 章節標題：## 第N章　標題（年份）
    const chapMatch = line.match(/^##\s*第(\d+)章[\s　]*(.+?)（(\d{4})/);
    if (chapMatch) {
      current = { heroId, chapter: Number(chapMatch[1]), title: chapMatch[2].trim(), year: Number(chapMatch[3]), lines: [], codex: [] };
      chapters.push(current);
      continue;
    }
    if (!current) continue;

    // 場景小標（要在略過 # 標題之前處理）
    const scene = sceneLine(line);
    if (scene) {
      current.lines.push(scene);
      continue;
    }
    if (isSkippable(line)) continue;

    // 圖鑑解鎖：✦ 圖鑑【標題】：內文
    const codexMatch = line.match(/^✦\s*圖鑑【(.+?)】[：:]\s*(.+)$/);
    if (codexMatch) {
      const title = codexMatch[1].trim();
      const cbody = codexMatch[2].trim();
      const id = `codex_${heroId}_${current.chapter}_${current.codex.length}`;
      current.codex.push({ id, type: classifyCodex(title), title, body: cbody });
      current.lines.push({ kind: 'codex', text: cbody, codexTitle: title, codexId: id });
      continue;
    }

    const content = contentLine(line);
    if (content) current.lines.push(content);
  }

  return chapters;
}

/** 解析夥伴招募劇本：以 ## mate:<id> 分段，回傳 mateId → 對話行。 */
function parseMates(raw: string): Record<string, StoryLine[]> {
  const out: Record<string, StoryLine[]> = {};
  let current: StoryLine[] | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const head = line.match(/^##\s*mate:([a-zA-Z_]+)/);
    if (head) {
      current = [];
      out[head[1]] = current;
      continue;
    }
    if (!current) continue;

    const scene = sceneLine(line);
    if (scene) {
      current.push(scene);
      continue;
    }
    if (isSkippable(line)) continue;

    const content = contentLine(line);
    if (content) current.push(content);
  }
  return out;
}

const PARSED: Record<string, ParsedChapter[]> = {
  lin: parseHero('lin', RAW.lin),
  peter: parseHero('peter', RAW.peter),
  chiyo: parseHero('chiyo', RAW.chiyo),
};

const MATE_SCRIPTS: Record<string, StoryLine[]> = parseMates(matesRaw);

/** 取得某主角某章的劇本 */
export function getChapterScript(heroId: string, chapter: number): ParsedChapter | undefined {
  return PARSED[heroId]?.find((c) => c.chapter === chapter);
}

/** 取得某夥伴的招募劇情；沒有則回 undefined（低星夥伴走簡單招募） */
export function getMateScript(mateId: string): StoryLine[] | undefined {
  const lines = MATE_SCRIPTS[mateId];
  return lines && lines.length ? lines : undefined;
}

/** 全部主角全部章節解鎖到的圖鑑（給圖鑑系統登錄用） */
export const ALL_STORY_CODEX: ParsedCodex[] = Object.values(PARSED)
  .flat()
  .flatMap((c) => c.codex);

/** 某章解鎖的圖鑑 id 清單 */
export function chapterCodexIds(heroId: string, chapter: number): string[] {
  return getChapterScript(heroId, chapter)?.codex.map((c) => c.id) ?? [];
}
