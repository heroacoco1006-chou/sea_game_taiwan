import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const storyDir = path.join(root, 'src', 'data', 'story');
const discoveries = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'discoveries.json'), 'utf8')).discoveries;
const mates = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'mates.json'), 'utf8')).mates;

const categories = [
  { id: 'event', label: '歷史事件', desc: '改變航路、政權或地方生活的重要事件。' },
  { id: 'people', label: '人物', desc: '主線、夥伴與各地歷史人物。' },
  { id: 'place', label: '地點與建築', desc: '港口、城堡、廟宇、商館與城市空間。' },
  { id: 'system', label: '勢力與制度', desc: '海禁、公司、政權、貿易規則與社會制度。' },
  { id: 'trade', label: '貿易品與產業', desc: '商品、產地、轉口與市場需求。' },
  { id: 'ship', label: '船隻與航海', desc: '船隊、航路、海圖與航海技術。' },
  { id: 'nature', label: '自然地理', desc: '山脈、海峽、火山、海岸與島嶼。' },
  { id: 'species', label: '生物', desc: '探索中可記錄的動植物。' },
  { id: 'treasure', label: '寶物與裝備', desc: '探險所得、紀念物與可使用裝備。' },
];

const expandedBodies = {
  '明末海禁': '海禁是明朝限制民間出海與海外貿易的政策。到了明末，福建、廣東沿海許多人仍靠海吃飯，需要把生絲、瓷器、茶葉運到日本、台灣或南洋換取白銀與香料。官方規定與百姓生計發生衝突，於是出現許多在合法與非法之間活動的海商、走私船與武裝船隊。月港因為一度被允許做民間海外貿易，成為福建商人出海的重要窗口。理解海禁，就能理解為什麼鄭芝龍、顏思齊這些人會在台海興起。',
  '顏思齊': '顏思齊是 17 世紀初活躍於台灣附近的漢人海商領袖。傳說他曾聚眾到笨港一帶活動，也與早期漢人移民、海上貿易和武裝船隊有關。關於他的細節，史料與傳說交錯，不能把所有故事都當成確定史實；但他象徵一個重要現象：在荷蘭人、明朝官府與鄭氏勢力完全穩定以前，台灣西部港口已經有漢人商船、移民與原住民社群互動。遊戲用他帶出笨港和早期台灣開發的入口。',
  '鄭芝龍': '鄭芝龍是明末台海最重要的海上勢力領袖之一。他曾在福建、日本平戶與台灣之間活動，熟悉多國語言與不同商人網絡。鄭芝龍既經營貿易，也掌握武裝船隊；他接受明朝招撫後，從海上首領變成朝廷官員，卻仍實際控制台灣海峽的重要航路。對玩家來說，鄭芝龍代表「海商、海盜、官員」三種身分交疊的時代特色，也能幫助理解後來鄭成功勢力的來源。',
  '鄭成功（國姓爺）': '鄭成功本名鄭森，是鄭芝龍之子。南明隆武帝賜他國姓「朱」與名「成功」，因此被尊稱為國姓爺。父親鄭芝龍降清後，鄭成功選擇繼續抗清，長期以廈門、金門為根據地經營海上力量。1661 年，他率軍渡海攻打荷蘭人在台灣的大員與熱蘭遮城，隔年迫使荷蘭長官揆一投降。遊戲中呈現鄭成功時，會同時提醒玩家：他既是台灣歷史重要人物，也處在明清易代、海上貿易與戰爭交錯的大時代。',
  '荷蘭東印度公司（VOC）': 'VOC 是荷蘭東印度公司，成立於 1602 年。它不是普通商店，而是由股東出資的大型海外貿易公司，擁有組織艦隊、建立城堡、簽訂條約甚至發動戰爭的權力。VOC 來到亞洲，是為了取得香料、生絲、瓷器、鹿皮與白銀等商品利潤。台灣的大員成為 VOC 連接中國、日本與東南亞的轉口據點。理解 VOC，就能理解為什麼一家公司會像國家一樣在海外建立城堡與軍隊。',
  '熱蘭遮城': '熱蘭遮城是荷蘭人在大員建立的主要城堡，位置約在今天台南安平。它不只是軍事據點，也是 VOC 在台灣收稅、管理貿易、儲放貨物與接待各地商人的中心。從熱蘭遮城出發，荷蘭人經營鹿皮、蔗糖、生絲轉口，也與西拉雅等地方社群、漢人移民、日本商人往來。1661–1662 年鄭成功圍攻熱蘭遮城，最後荷蘭投降，象徵台灣從荷蘭統治轉入明鄭時期。',
  '鹿皮與蔗糖': '17 世紀台灣鹿群眾多，鹿皮可以外銷日本，用於甲冑、衣物與日用品。荷蘭統治時期，台灣南部也逐漸發展甘蔗種植與製糖，蔗糖成為重要出口品。這兩種商品讓台灣不再只是船隊停靠點，而是能生產並輸出商品的貿易基地。不過，鹿皮貿易也改變了原住民狩獵與生活方式，蔗糖生產則牽動土地開墾與勞動安排。商品背後，常常連著人的生活改變。',
  '荷蘭治台制度': '荷蘭統治台灣期間，VOC 為了管理土地、貿易與地方社群，建立多種制度。「贌社」是把與原住民村社交易的權利標售給商人；「王田」則把土地視為公司所有，再讓漢人開墾納稅。這些制度讓公司能增加收入，也帶來秩序與市場擴張，但同時加重地方社群與移民負擔。遊戲中提到這些制度，是要讓玩家看到殖民統治不只是城堡與船砲，也包含稅、土地與日常生活的壓力。',
  '郭懷一事件': '1652 年，台灣漢人移民領袖郭懷一因不滿荷蘭統治下的重稅與壓迫，率眾起事反抗。這次行動很快被荷蘭軍隊鎮壓，但它顯示台灣南部的移民社群已經相當龐大，也顯示 VOC 的統治並不穩固。對小朋友來說，可以把這件事理解成：當政府或公司只重視收稅與利益，卻忽略居民生活壓力時，衝突就容易爆發。',
  '鎖國令': '17 世紀上半，日本幕府陸續頒布限制海外往來的命令。原因包括防範基督教擴張、避免地方大名靠海外貿易變強，也希望把對外關係集中管理。1635 年以後，日本人被禁止出海，原本活躍的朱印船貿易逐漸結束。鎖國不是完全不往來，而是把窗口縮小到長崎出島等少數地方。這改變了日本商人、台灣轉口貿易與整個東亞航線的運作方式。',
  '朱印船貿易': '朱印船是得到日本幕府頒發「朱印狀」許可出海的商船，活躍於 17 世紀初。它們往來日本、台灣、呂宋、交趾支那與暹羅等地，帶動白銀、生絲、鹿皮、香料與工藝品流通。許多日本人在海外港口形成日本人町，與華人、東南亞商人和歐洲勢力互動。朱印船貿易讓玩家看到，日本在鎖國以前曾是非常活躍的海上貿易參與者。',
  '濱田彌兵衛事件': '1628 年，日本朱印船商人濱田彌兵衛因貿易稅、管轄權與待遇問題，與荷蘭大員商館爆發衝突，甚至挾持荷蘭長官。這件事後來演變成日荷之間的外交風波，一度影響雙方貿易。它提醒玩家：台灣不是單一勢力能隨意支配的地方，而是日本商人、荷蘭 VOC、漢人海商與地方社群共同交會的舞台。不同人都在爭取安全、利益與面子。',
  '料羅灣海戰': '1633 年，荷蘭東印度公司為了逼明朝開放貿易，聯合海盜劉香進犯福建沿海。鄭芝龍代表明朝水師迎戰，在料羅灣利用火攻等戰術大破荷蘭與海盜聯軍。此戰讓鄭芝龍的地位更加穩固，也讓他掌握台灣海峽制海權。這場戰役很適合放進遊戲，因為它同時包含海戰、貿易談判、海盜勢力與國家政策，能看出大航海時代不是只有買賣，也有武力競爭。',
  '鄭成功攻台與熱蘭遮城之戰': '1661 年，鄭成功率軍渡海，從鹿耳門附近進入台江內海，圍攻荷蘭人在台灣的中心熱蘭遮城。圍城持續約九個月，1662 年初，荷蘭末代長官揆一投降，結束荷蘭在台灣約三十八年的統治。這件事是台灣歷史的重大轉折：台灣從 VOC 的轉口殖民據點，轉入明鄭政權時期。遊戲會用不同主角視角呈現，不把任何一方簡化成單純好人或壞人。',
};

function categoryFor(type, title, kind = '') {
  if (kind === 'species') return 'species';
  if (kind === 'treasure') return 'treasure';
  if (kind === 'geography') return 'nature';
  if (kind === 'culture') return 'system';
  if (kind === 'place') return 'place';
  if (kind === 'scenery') {
    return /(斷崖|潟湖|玄武岩|河道|海峽|群島|火山)/.test(title) ? 'nature' : 'place';
  }
  if (/朱印船|船|航路|海圖|航海/.test(title)) return 'ship';
  if (/鹿皮|蔗糖|白銀|生絲|香料|貿易品|產業/.test(title)) return 'trade';
  if (/VOC|公司|制度|海禁|鎖國|朝貢|贌社|王田|霸權|貿易網|中介|窗口/.test(title)) return 'system';
  if (/事件|之戰|海戰|受撫|崛起|易代|降清|攻台|威脅|驅逐|衝突|起事|落幕/.test(title)) return 'event';
  if (/顏思齊|鄭芝龍|鄭成功|郭懷一|濱田|鄭和|沈有容|李旦|施琅|何斌/.test(title) || type === '人物') return 'people';
  if (/城|港|島|大員|笨港|澎湖|那霸|琉球|出島|商館|廟|教堂|市集|工坊/.test(title)) return 'place';
  return 'system';
}

function firstSentence(text) {
  const compact = text.replace(/\s+/g, '');
  const hit = compact.match(/^(.{12,54}?[。！？])/);
  return hit ? hit[1] : compact.slice(0, 54);
}

function defaultWhy(category) {
  return {
    event: '這件事改變了人物選擇、航線安全或台灣局勢，是理解主線時代背景的關鍵。',
    people: '人物的選擇會影響航路、貿易與政權變化，也能讓玩家從人的角度理解歷史。',
    place: '地點與建築讓玩家知道歷史不是抽象名詞，而是發生在具體港口、城堡與街市中。',
    system: '制度會影響誰能出海、誰能交易、誰要繳稅，也常常是衝突的原因。',
    trade: '商品讓港口彼此連起來，也讓玩家理解為什麼不同勢力會爭奪航路。',
    ship: '航海技術與船隊活動決定人們能到哪裡，也影響貿易、探索與戰爭。',
    nature: '自然地理會影響港口位置、航行風險、物產與人們生活方式。',
    species: '生物圖鑑讓玩家知道探索不只找寶物，也是在認識土地與環境。',
    treasure: '寶物與裝備把探索成果帶回遊戲系統，也提醒玩家物品背後有文化故事。',
  }[category] ?? '這個項目能幫助玩家補足時代背景。';
}

function defaultKidNote(category) {
  return {
    event: '可以先記住「誰、在哪裡、為什麼發生、造成什麼改變」。',
    people: '人物不是只有好壞，常常是在自己的立場與時代壓力下做選擇。',
    place: '看地點時，可以想像船從哪裡進港、貨物在哪裡交換、居民怎麼生活。',
    system: '制度就是一套規則；規則若和生活需要衝突，就可能引發反抗或走私。',
    trade: '貿易品的價值通常來自稀少、需求高、運送遠或加工困難。',
    ship: '船不是只有速度，還要考慮水手、補給、貨艙與風向。',
    nature: '地形、氣候與生物會影響人怎麼移動、交易與定居。',
    species: '有些名稱是現代分類；遊戲用現代稱呼幫助學習，當時的人不一定這樣命名。',
    treasure: '寶物可以很有價值，但也要想想它從哪裡來、代表什麼文化。',
  }[category] ?? '讀圖鑑時先抓關鍵詞，再回到遊戲裡找例子。';
}

function enrichBody(title, body, category, sourceNote = '') {
  const expanded = expandedBodies[title] ?? body;
  const add = {
    event: '這類事件通常不是單一原因造成，而是貿易利益、政治壓力、軍事力量與地方生活交錯後爆發。',
    people: '閱讀人物圖鑑時，可以注意他和哪個港口、哪條航線、哪個勢力有關。',
    place: '這個地點可以和世界地圖上的航線一起看，理解它為什麼會成為商船停靠或勢力競爭的位置。',
    system: '這種制度會影響普通水手、商人、移民與地方社群的生活，並不只是官府文件上的規定。',
    trade: '商品能賺錢，是因為產地、需求地與運輸風險不同，這也是遊戲貿易玩法的核心。',
    ship: '航海相關知識會直接影響玩家規劃航線、補給與探索的方式。',
    nature: '自然環境不是背景裝飾，它會影響港口形成、航行安全與地方物產。',
    species: '記錄物種時，也是在認識牠生活的環境；保護環境才能讓生物繼續存在。',
    treasure: '遊戲中的寶物同時是獎勵與故事線索，不只是賣錢道具。',
  }[category] ?? '';
  const note = sourceNote ? `\n\n註記：${sourceNote}` : '';
  return expanded.includes(add) || expanded.length > 170 ? `${expanded}${note}` : `${expanded}${add}${note}`;
}

function makeEntry({ id, title, type, body, category, source, sourceNote, unlockHint }) {
  const finalCategory = category ?? categoryFor(type, title);
  const finalBody = enrichBody(title, body, finalCategory, sourceNote);
  return {
    id,
    category: finalCategory,
    type: categories.find((c) => c.id === finalCategory)?.label ?? type,
    title,
    short: firstSentence(finalBody),
    body: finalBody,
    whyImportant: defaultWhy(finalCategory),
    kidNote: defaultKidNote(finalCategory),
    unlockHint,
    source,
  };
}

function parseStoryCodex(heroId, fileName) {
  const raw = fs.readFileSync(path.join(storyDir, fileName), 'utf8');
  const entries = [];
  let chapter = 0;
  let index = 0;
  for (const line of raw.split(/\r?\n/)) {
    const chap = line.match(/^## 第(\d+)章/);
    if (chap) {
      chapter = Number(chap[1]);
      index = 0;
      continue;
    }
    const codex = line.match(/^✦\s*圖鑑【(.+?)】[：:]\s*(.+)$/);
    if (codex) {
      const title = codex[1].trim();
      const body = codex[2].trim();
      entries.push(makeEntry({
        id: `codex_${heroId}_${chapter}_${index}`,
        title,
        type: '主線',
        body,
        category: categoryFor('主線', title),
        source: `story:${heroId}:${chapter}`,
        unlockHint: '推進對應主線章節後解鎖。',
      }));
      index += 1;
    }
  }
  return entries;
}

const storyEntries = [
  ...parseStoryCodex('lin', 'lin_海商線.md'),
  ...parseStoryCodex('peter', 'peter_VOC線.md'),
  ...parseStoryCodex('chiyo', 'chiyo_朱印船線.md'),
];

const discoveryEntries = discoveries.map((d) => makeEntry({
  id: d.id,
  title: d.title,
  type: d.type,
  body: d.body,
  category: categoryFor(d.type, d.title, d.kind),
  source: `discovery:${d.kind}`,
  unlockHint: d.kind === 'scenery' ? '靠近世界地圖上的風景點後發現。' : '在探索點調查時有機會發現。',
}));

const mateEntries = mates.map((m) => makeEntry({
  id: `mate_${m.id}`,
  title: m.name,
  type: '人物',
  body: `${m.codexBody}\n\n在遊戲中，${m.name}可擔任的職位會影響船隊能力；招募條件則反映他的身分、時機或主角線立場。`,
  category: 'people',
  source: `mate:${m.id}`,
  sourceNote: m.history,
  unlockHint: '在酒館結識並招募這位夥伴後解鎖。',
}));

const allEntries = [...storyEntries, ...discoveryEntries, ...mateEntries];
const seen = new Set();
for (const entry of allEntries) {
  if (seen.has(entry.id)) throw new Error(`Duplicate codex id: ${entry.id}`);
  seen.add(entry.id);
}

function mdText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function codexMarkdown(entries) {
  const lines = [
    '---',
    'title: 大航海福爾摩沙圖鑑資料庫',
    'type: data',
    'tags: [sea_game, codex, 圖鑑, 教育資料]',
    'updated: 2026-06-15',
    'author: Codex',
    'status: draft',
    '---',
    '',
    '# 大航海福爾摩沙圖鑑資料庫',
    '',
    '> 本檔是圖鑑資料的 Markdown 校對版，方便逐條比對歷史、人文與自然說明。',
    '> 遊戲執行時仍讀取 `src/data/codex.json`；若校訂本檔內容，需同步回 `codex.json`。',
    '',
    '## 分類總覽',
    '',
  ];
  for (const cat of categories) {
    const count = entries.filter((entry) => entry.category === cat.id).length;
    lines.push(`- **${cat.label}**（${cat.id}）：${cat.desc}（${count} 筆）`);
  }
  lines.push('');

  for (const cat of categories) {
    const items = entries.filter((entry) => entry.category === cat.id);
    lines.push(`## ${cat.label}`, '');
    lines.push(`> ${cat.desc}`, '');
    for (const entry of items) {
      lines.push(`### ${entry.title}`, '');
      lines.push(`- id：\`${entry.id}\``);
      lines.push(`- 類型：${entry.type}`);
      lines.push(`- 來源：${entry.source}`);
      lines.push(`- 解鎖提示：${entry.unlockHint}`);
      lines.push('');
      lines.push('#### 摘要', '');
      lines.push(mdText(entry.short), '');
      lines.push('#### 完整說明', '');
      lines.push(mdText(entry.body), '');
      lines.push('#### 為什麼重要', '');
      lines.push(mdText(entry.whyImportant), '');
      lines.push('#### 閱讀提示', '');
      lines.push(mdText(entry.kidNote), '');
    }
  }
  return `${lines.join('\n')}\n`;
}

const out = {
  _note: '圖鑑主資料。主線、探索、夥伴只負責解鎖 id；分類、完整說明與提示以本檔為準。',
  categories,
  entries: allEntries,
};

fs.writeFileSync(path.join(root, 'src', 'data', 'codex.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(root, 'src', 'data', 'codex.md'), codexMarkdown(allEntries), 'utf8');
console.log(`Wrote ${allEntries.length} codex entries.`);
