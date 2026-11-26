import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const storyDir = path.join(root, 'src', 'data', 'story');
const discoveries = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'discoveries.json'), 'utf8')).discoveries;
const mates = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'mates.json'), 'utf8')).mates;
const reputationEvents = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'reputationEvents.json'), 'utf8')).events;

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
  '顏思齊': '顏思齊是 17 世紀初活躍於台灣附近的漢人海商領袖。傳說他曾聚眾到笨港一帶活動，也與早期漢人移民、海上貿易和武裝船隊有關。關於他的細節，史料與傳說交錯，不能把所有故事都當成確定史實；但他象徵一個重要現象：在荷蘭人、明朝官府與鄭氏勢力完全穩定以前，台灣西部港口已經有漢人商船、移民與原住民社群互動。閱讀他的故事時，可以把焦點放在笨港、早期移民與海上貿易之間的關係。',
  '鄭芝龍': '鄭芝龍是明末台海最重要的海上勢力領袖之一。他曾在福建、日本平戶與台灣之間活動，熟悉多國語言與不同商人網絡。鄭芝龍既經營貿易，也掌握武裝船隊；他接受明朝招撫後，從海上首領變成朝廷官員，卻仍實際控制台灣海峽的重要航路。他同時展現了「海商、海盜、官員」三種身分交疊的時代特色，也能幫助我們理解後來鄭成功勢力的來源。',
  '鄭成功（國姓爺）': '鄭成功本名鄭森，是鄭芝龍之子。南明隆武帝賜他國姓「朱」與名「成功」，因此被尊稱為國姓爺。父親鄭芝龍降清後，鄭成功選擇繼續抗清，長期以廈門、金門為根據地經營海上力量。1661 年，他率軍渡海攻打荷蘭人在台灣的大員與熱蘭遮城，隔年迫使荷蘭長官揆一投降。理解鄭成功時，不能只用單一英雄或敵人的角度；他既是台灣歷史重要人物，也處在明清易代、海上貿易與戰爭交錯的大時代。',
  '荷蘭東印度公司（VOC）': 'VOC 是荷蘭東印度公司，成立於 1602 年。它不是普通商店，而是由股東出資的大型海外貿易公司，擁有組織艦隊、建立城堡、簽訂條約甚至發動戰爭的權力。VOC 來到亞洲，是為了取得香料、生絲、瓷器、鹿皮與白銀等商品利潤。台灣的大員成為 VOC 連接中國、日本與東南亞的轉口據點。理解 VOC，就能理解為什麼一家公司會像國家一樣在海外建立城堡與軍隊。',
  '熱蘭遮城': '熱蘭遮城是荷蘭人在大員建立的主要城堡，位置約在今天台南安平。它不只是軍事據點，也是 VOC 在台灣收稅、管理貿易、儲放貨物與接待各地商人的中心。從熱蘭遮城出發，荷蘭人經營鹿皮、蔗糖、生絲轉口，也與西拉雅等地方社群、漢人移民、日本商人往來。1661–1662 年鄭成功圍攻熱蘭遮城，最後荷蘭投降，象徵台灣從荷蘭統治轉入明鄭時期。',
  '鹿皮與蔗糖': '17 世紀台灣鹿群眾多，鹿皮可以外銷日本，用於甲冑、衣物與日用品。荷蘭統治時期，台灣南部也逐漸發展甘蔗種植與製糖，蔗糖成為重要出口品。這兩種商品讓台灣不再只是船隊停靠點，而是能生產並輸出商品的貿易基地。不過，鹿皮貿易也改變了原住民狩獵與生活方式，蔗糖生產則牽動土地開墾與勞動安排。商品背後，常常連著人的生活改變。',
  '荷蘭治台制度': '荷蘭統治台灣期間，VOC 為了管理土地、貿易與地方社群，建立多種制度。「贌社」是把與原住民村社交易的權利標售給商人；「王田」則把土地視為公司所有，再讓漢人開墾納稅。這些制度讓公司能增加收入，也帶來秩序與市場擴張，但同時加重地方社群與移民負擔。這些制度說明殖民統治不只是城堡與船砲，也包含稅、土地與日常生活的壓力。',
  '郭懷一事件': '1652 年，台灣漢人移民領袖郭懷一因不滿荷蘭統治下的重稅與壓迫，率眾起事反抗。這次行動很快被荷蘭軍隊鎮壓，但它顯示台灣南部的移民社群已經相當龐大，也顯示 VOC 的統治並不穩固。我們可以把這件事理解成：當政府或公司只重視收稅與利益，卻忽略居民生活壓力時，衝突就容易爆發。',
  '鎖國令': '17 世紀上半，日本幕府陸續頒布限制海外往來的命令。原因包括防範基督教擴張、避免地方大名靠海外貿易變強，也希望把對外關係集中管理。1635 年以後，日本人被禁止出海，原本活躍的朱印船貿易逐漸結束。鎖國不是完全不往來，而是把窗口縮小到長崎出島等少數地方。這改變了日本商人、台灣轉口貿易與整個東亞航線的運作方式。',
  '朱印船貿易': '朱印船是得到日本幕府頒發「朱印狀」許可出海的商船，活躍於 17 世紀初。它們往來日本、台灣、呂宋、交趾支那與暹羅等地，帶動白銀、生絲、鹿皮、香料與工藝品流通。許多日本人在海外港口形成日本人町，與華人、東南亞商人和歐洲勢力互動。這段歷史讓我們看見，日本在鎖國以前曾是非常活躍的海上貿易參與者。',
  '濱田彌兵衛事件': '1628 年，日本朱印船商人濱田彌兵衛因貿易稅、管轄權與待遇問題，與荷蘭大員商館爆發衝突，甚至挾持荷蘭長官。這件事後來演變成日荷之間的外交風波，一度影響雙方貿易。它提醒我們：台灣不是單一勢力能隨意支配的地方，而是日本商人、荷蘭 VOC、漢人海商與地方社群共同交會的舞台。不同人都在爭取安全、利益與面子。',
  '料羅灣海戰': '1633 年，荷蘭東印度公司為了逼明朝開放貿易，聯合海盜劉香進犯福建沿海。鄭芝龍代表明朝水師迎戰，在料羅灣利用火攻等戰術大破荷蘭與海盜聯軍。此戰讓鄭芝龍的地位更加穩固，也讓他掌握台灣海峽制海權。這場戰役同時牽涉海戰、貿易談判、海上武裝勢力與國家政策，說明大航海時代不只有買賣，也有武力競爭。',
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

/** 區分重複標題的覆寫表（保留既有 ID 不變，確保舊存檔與插圖完全相容）。 */
const uniqueTitleById = {
  codex_lin_2_1: '顏思齊（笨港海商）',
  codex_lin_3_0: '鄭芝龍（台海霸主）',
  codex_peter_5_0: '濱田彌兵衛事件（荷蘭視角）',
  codex_chiyo_2_0: '濱田彌兵衛事件（日本商船視角）',
};

/** 核心 32 筆主線圖鑑的專屬「為什麼重要」與「閱讀提示」，讓每條歷史都能讀到量身訂做的白話故事與思考題。 */
const customNotesById = {
  codex_lin_1_0: {
    whyImportant: '明朝的「海禁」規定誰能合法出海，決定了福建商船只能從月港出發，也讓許多百姓被迫走上灰色航路。',
    kidNote: '想想看：如果你住在靠海吃飯的小鎮，政府卻突然不准出海捕魚經商，大家會想出什麼辦法？',
  },
  codex_lin_2_0: {
    whyImportant: '笨港是台灣早期漢人開墾與海商補給的重要據點，見證了台灣西部港灣如何從小漁村長成熱鬧聚落。',
    kidNote: '下次經過台灣中部海岸時，可以想想當年沒有現代防波堤，小帆船是怎麼趁漲潮開進笨港河口的。',
  },
  codex_lin_2_1: {
    whyImportant: '顏思齊代表早於荷蘭統治的民間海商力量，他把笨港變成渡海開墾的起點，是台灣早期開發史的關鍵人物。',
    kidNote: '歷史書與民間傳說裡的顏思齊有點不一樣——讀歷史時要記得分辨「確定的紀錄」和「後人的傳說」喔！',
  },
  codex_lin_3_0: {
    whyImportant: '鄭芝龍從海商起家，最後變成能號令整個台灣海峽的水師官員，奠定了後來鄭家橫跨東亞的海洋帝國基礎。',
    kidNote: '鄭芝龍會說閩南語、日語，還懂葡萄牙語！會多國語言在當時的大航海上就像多了一把萬能鑰匙。',
  },
  codex_lin_3_1: {
    whyImportant: '中國江南出產的生絲是日本武士與貴族最搶手的衣料原料，一艘滿載生絲的商船往往能換回整箱日本白銀。',
    kidNote: '你在交易所買進月港便宜的生絲、運到平戶或長崎高價賣出，走的就是當年最賺錢的「絲銀航線」！',
  },
  codex_lin_4_0: {
    whyImportant: '顏思齊過世後，鄭芝龍整合了原本分散的海商船隊，讓福建沿海的海上勢力從各自為戰變成組織嚴密的艦隊。',
    kidNote: '想想看：一支分散的小船隊和一支聽從統一號令的大艦隊，在海上遇到危機時差別會有多大？',
  },
  codex_lin_5_0: {
    whyImportant: '明朝決定招撫而非硬打鄭芝龍，讓民間最大武裝船隊轉身成為官軍，徹底改變了台灣海峽的勢力平衡。',
    kidNote: '原本的對手突然變成了合作夥伴——歷史上很多時候，「談判」比「開砲」更能改變局勢。',
  },
  codex_lin_6_0: {
    whyImportant: '1633 年料羅灣海戰是東方傳統帆船用火攻戰術擊敗歐洲重砲艦隊的著名戰役，荷蘭人從此承認鄭氏在台海的地位。',
    kidNote: '火船順風衝向大帆船，就像六角海戰裡軍師的「順風火攻」計策——善用風向往往能以小搏大！',
  },
  codex_lin_7_0: {
    whyImportant: '商船必須先向鄭家繳費領取令旗才能安心航行，這套海上護航與收費制度讓鄭家累積了驚人的財富與艦隊。',
    kidNote: '這就像是十七世紀的「海上高速公路通行證」，沒有令旗的商船很容易在半路被攔下來盤查。',
  },
  codex_lin_8_0: {
    whyImportant: '明清易代撕裂了許多家庭，鄭芝龍選擇降清、兒子鄭成功卻堅持抗清，這個抉擇把台灣推向了新的歷史命運。',
    kidNote: '當家人對未來有完全不同的判斷時該怎麼辦？這正是大時代裡最讓人為難的人生考題。',
  },
  codex_lin_9_0: {
    whyImportant: '鄭成功以廈門、金門為基地持續海上貿易籌措軍費，後來揮軍渡海攻台，成為台灣歷史上最具轉折性的人物之一。',
    kidNote: '鄭成功的母親是日本平戶人田川氏，他從小就在跨國文化的環境裡長大，很早就熟悉海外貿易。',
  },
  codex_lin_10_0: {
    whyImportant: '1661 至 1662 年的熱蘭遮城之戰結束了荷蘭 38 年統治，讓台灣進入明鄭時期，是台灣史上最重要的轉捩點之一。',
    kidNote: '試著分別玩林海生、彼得與千代三條線的第 10 章，你會發現同一場戰役在不同人眼中感受完全不同！',
  },
  codex_peter_1_0: {
    whyImportant: 'VOC 是全世界最早的跨國股份公司之一，甚至能自己發行股票、造戰艦和蓋城堡，把整個亞洲納入了世界貿易網。',
    kidNote: '如果今天有一家便利商店公司能自己養海軍和蓋要塞，是不是超驚人？當年的荷蘭東印度公司就是這樣！',
  },
  codex_peter_2_0: {
    whyImportant: '荷蘭人原本想強佔澎湖當基地，結果被明軍包圍談判後才轉往台灣大員，這場衝突意外開啟了荷蘭治台時代。',
    kidNote: '澎湖位在台灣海峽正中央，從地圖上看就知道它有多重要——誰守住澎湖，就看得到整個海峽的船！',
  },
  codex_peter_3_0: {
    whyImportant: '熱蘭遮城不只是紅磚城堡，還是荷蘭人在台灣的指揮總部、倉庫與海關，把台南安平推上了東亞貿易的舞台中央。',
    kidNote: '今天去台南安平古堡玩時，摸一摸外圍那堵老磚牆，那就是四百年前熱蘭遮城留下來的遺跡喔！',
  },
  codex_peter_4_0: {
    whyImportant: '台灣不再只是貨船路過的轉運站，靠著大量外銷鹿皮與蔗糖，真正成為能自己生產高價值特產的貿易寶島。',
    kidNote: '大量獵鹿賺了錢，卻也讓台灣平原上的野生梅花鹿越來越少——經濟發展和生態保護常常需要找到平衡。',
  },
  codex_peter_5_0: {
    whyImportant: '對剛在大員站穩腳跟的荷蘭商館來說，濱田彌兵衛事件是一場差點斷送對日貿易的嚴重外交危機。',
    kidNote: '荷蘭長官覺得自己在收合法關稅，日本船長卻覺得自己先來卻被欺負——換成是你，會怎麼化解這場僵局？',
  },
  codex_peter_6_0: {
    whyImportant: '1642 年荷蘭人北上攻下雞籠與淡水，趕走了原本盤踞北台灣的西班牙人，從此控制了台灣南北重要港口。',
    kidNote: '你可以去雞籠和淡水的港町看看聖薩爾瓦多城與紅毛城地標，想像四百年前歐洲兩大強權在北台灣對峙的畫面！',
  },
  codex_peter_7_0: {
    whyImportant: '荷蘭人透過「贌社」與「王田」管理原住民交易與漢人開墾，雖然增加了稅收，卻也讓許多居民生活越來越沉重。',
    kidNote: '制度設計得好能讓大家安居樂業，但如果只顧著收稅不管百姓辛苦，久了就會埋下反抗的種子。',
  },
  codex_peter_8_0: {
    whyImportant: '1652 年的郭懷一事件展現了台灣漢人移民人數已相當龐大，也讓荷蘭官員警覺重稅政策帶來的危機。',
    kidNote: '這件事發生後，荷蘭人趕緊在赤崁新建了普羅民遮城（今天的赤崁樓），用來加強對市鎮的防衛。',
  },
  codex_peter_9_0: {
    whyImportant: '當鄭成功在對岸集結大軍的消息傳來，熱蘭遮城陷入要增援還是要和談的兩難，巴達維亞總部卻誤判了情勢。',
    kidNote: '當時沒有手機和網路，一封求救信從台灣寄到爪哇巴達維亞，來回往往要等上好幾個月和一整季季風！',
  },
  codex_peter_10_0: {
    whyImportant: '長達九個月的圍城後，荷蘭長官揆一為了保全城內居民與士兵性命選擇簽約撤離，展現了戰爭背後沉重的人道考量。',
    kidNote: '條約簽訂後，荷蘭人獲准帶著旗幟與私人物品體面離開，這在當時的戰爭中其實算是相當克制的收尾方式。',
  },
  codex_chiyo_1_0: {
    whyImportant: '朱印船是日本幕府正式核發許可證的遠洋商船，讓日本在鎖國之前就活躍於台灣、越南與泰國的各大商港。',
    kidNote: '船長出海前要把蓋著紅色大印的「朱印狀」收好，那就像是古代最正式的國際護照！',
  },
  codex_chiyo_2_0: {
    whyImportant: '站在日本朱印船商人的立場，這場衝突關乎自己在台灣多年累積的貿易權利與船隊尊嚴，雙方互不相讓。',
    kidNote: '對照彼得線的第 5 章一起看，同一件事為什麼兩邊都覺得自己有理？學會「換位思考」是讀歷史最棒的收穫！',
  },
  codex_chiyo_3_0: {
    whyImportant: '日本盛產白銀、中國盛產生絲，台灣正好位在兩者之間，成為把白銀和生絲串在一起的黃金中介點。',
    kidNote: '打開世界海圖看一看：從月港到大員、再順著黑潮北上九州平戶，是不是一條超順暢的三角形航線？',
  },
  codex_chiyo_4_0: {
    whyImportant: '琉球王國雖然土地不大，卻靠著靈活的轉口貿易連結中國、日本與東南亞，自豪地稱自己為「萬國津梁」。',
    kidNote: '「津梁」就是橋梁的意思——就算是個小島國，只要善用地理位置與外交智慧，也能成為大家離不開的好鄰居。',
  },
  codex_chiyo_5_0: {
    whyImportant: '當幕府限制越來越嚴格、荷蘭又壟斷航線時，許多日本民間商人面臨失去家族航路的命運，必須重新尋找生路。',
    kidNote: '時代的規則一夕改變時，普通百姓往往最先感受到衝擊，但也常在困境中學會適應與合作。',
  },
  codex_chiyo_6_0: {
    whyImportant: '1635 年起幕府禁止日本人出海與歸國，結束了繁華的朱印船時代，也迫使東亞海上貿易重新洗牌。',
    kidNote: '許多住在東南亞「日本人町」的商人從此再也回不了家鄉，只能在異鄉落地生根，成為歷史裡動人的一頁。',
  },
  codex_chiyo_7_0: {
    whyImportant: '鎖國後的長崎出島雖然只是一座小小的扇形人工島，卻替日本保留了了解世界科學、醫學與海外消息的唯一窗口。',
    kidNote: '去長崎港町找找「出島扇形海堤碑」地標，看看這座小小的島怎麼連結起東西方兩個世界！',
  },
  codex_chiyo_8_0: {
    whyImportant: '在政權對立與海禁鎖國的縫隙間，中國、日本、台灣與荷蘭的普通商人依然靠著信用與友誼維持跨海交流。',
    kidNote: '歷史課本常寫戰爭與條約，但其實撐起整個大航海時代的，是千千萬萬遵守信用、互相幫忙的普通船員與商人。',
  },
  codex_chiyo_9_0: {
    whyImportant: '台灣海峽只要一有戰事風聲，不只台灣緊張，連遠在長崎、澳門與巴達維亞的商人和貨船都會立刻受到影響。',
    kidNote: '早在四百年前，東亞各地就已經緊密連在一起了——一座港口的變化，很快就會像漣漪一樣傳遍整片大海。',
  },
  codex_chiyo_10_0: {
    whyImportant: '從民間商人的雙眼回望熱蘭遮城落幕，我們看見的不只是誰贏誰輸，更是普通人期盼和平通商的共同心願。',
    kidNote: '恭喜你走完這段大航海旅程！別忘了到圖鑑裡比較三條路線，看看這四百年前的故事拼出了什麼樣完整的台灣！',
  },
};

function defaultWhy(category) {
  return {
    event: '這件事改變了人物選擇、航線安全或台灣局勢，是理解當時時代背景的重要關鍵。',
    people: '每個歷史人物的選擇都牽動著航路、貿易與政權變化，從他們的故事裡更能看見有溫度的歷史。',
    place: '透過真實存在的港口、城堡與街市，我們會發現歷史不只是課本名詞，而是發生在具體土地上的故事。',
    system: '制度決定了誰能出海、誰能做生意、誰要繳稅，一旦規則與百姓生活衝突，往往就會掀起大波瀾。',
    trade: '一件件商品把遙遠的港口串了起來，也解釋了為什麼各國船隊都願意冒著風浪爭奪航路。',
    ship: '造船與航海技術決定人們能航行多遠，也直接影響了貿易、探索與海戰的勝負。',
    nature: '山脈、海峽、季風與海流會決定港口建在哪裡、船隊怎麼航行，也塑造了各地獨特的物產。',
    species: '認識各地動植物，能讓我們體會探索不只是找寶藏，更是細心觀察這片土地與自然環境。',
    treasure: '每件旅途中找到的寶物與工具，背後都藏著一段當時工藝、信仰或跨海交流的小故事。',
  }[category] ?? '這筆紀錄能幫你把當時的歷史背景拼得更完整。';
}

function defaultKidNote(category) {
  return {
    event: '讀歷史事件時，可以先抓出四個線索：「誰、在哪裡、為什麼發生、後來改變了什麼」。',
    people: '歷史人物很少只有單純的好人或壞人，試著想想他們站在自己的時代裡面對什麼壓力。',
    place: '看這座地點時，不妨在腦海裡想像商船怎麼靠岸、碼頭上喊著什麼語言、大家在交換什麼貨物。',
    system: '制度就像班級或社會的規則；當規則和大家的生活需求打架時，常常就會出現反抗或變通的辦法。',
    trade: '一樣商品之所以值錢，通常因為它很稀少、別的地方很需要，或者跨越重洋運送非常辛苦。',
    ship: '挑一艘好船不只看跑得快不快，還要同時盤算水手人數、糧水空間、貨艙大小與季風方向。',
    nature: '地形、天氣與海流看似靜靜的，其實悄悄決定了人類怎麼移動、貿易與定居。',
    species: '有些生物名稱採用現代分類方便學習，四百年前的水手與當地居民可能有自己親切的叫法喔！',
    treasure: '拿到稀奇的寶物時，除了看它值多少兩銀子，也可以想想它從哪座島來、代表誰的文化。',
  }[category] ?? '讀圖鑑時先抓關鍵詞，再回到大海航行中找找看它的蹤跡！';
}

function enrichBody(title, body, category, sourceNote = '') {
  const expanded = expandedBodies[title] ?? body;
  const add = {
    event: '這類事件通常不是單一原因造成，而是貿易利益、政治壓力、軍事力量與地方生活交錯後爆發。',
    people: '閱讀人物圖鑑時，可以注意這個人物和哪個港口、哪條航線、哪個勢力有關。',
    place: '這個地點可以和世界地圖上的航線一起看，理解它為什麼會成為商船停靠或勢力競爭的位置。',
    system: '這種制度會影響普通水手、商人、移民與地方社群的生活，並不只是官府文件上的規定。',
    trade: '商品能賺錢，是因為產地、需求地與運輸風險不同，這也是遊戲貿易玩法的核心。',
    ship: '這些航海知識不只好玩，也能直接幫你規劃更安全、更省糧水的遠洋航線。',
    nature: '自然環境不是背景裝飾，它會影響港口形成、航行安全與地方物產。',
    species: '記錄物種時，也是在認識牠生活的環境；保護環境才能讓生物繼續存在。',
    treasure: '遊戲中的寶物同時是獎勵與故事線索，不只是賣錢道具。',
  }[category] ?? '';
  const note = sourceNote ? `\n\n註記：${sourceNote}` : '';
  return expanded.includes(add) || expanded.length > 170 ? `${expanded}${note}` : `${expanded}${add}${note}`;
}

function makeEntry({ id, title, type, body, category, source, sourceNote, unlockHint }) {
  const finalCategory = category ?? categoryFor(type, title);
  const finalTitle = uniqueTitleById[id] ?? title;
  const finalBody = enrichBody(title, body, finalCategory, sourceNote);
  const custom = customNotesById[id];
  return {
    id,
    category: finalCategory,
    type: categories.find((c) => c.id === finalCategory)?.label ?? type,
    title: finalTitle,
    short: firstSentence(finalBody),
    body: finalBody,
    whyImportant: custom?.whyImportant ?? defaultWhy(finalCategory),
    kidNote: custom?.kidNote ?? defaultKidNote(finalCategory),
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
  body: `${m.codexBody}\n\n在遊戲中，${m.name}可擔任的職位會影響船隊能力；招募條件則反映這位夥伴的身分、時機或主角線立場。`,
  category: 'people',
  source: `mate:${m.id}`,
  sourceNote: m.history,
  unlockHint: '在酒館結識並招募這位夥伴後解鎖。',
}));

const reputationEventEntries = reputationEvents.map((event) => makeEntry({
  id: event.codexEntry.id,
  title: event.codexEntry.title,
  type: '聲望特殊事件',
  body: event.codexEntry.body,
  category: event.codexEntry.category,
  source: `reputation-event:${event.id}`,
  sourceNote: event.codexEntry.sourceNote,
  unlockHint: `完成聲望特殊事件「${event.title}」後解鎖。`,
}));

const allEntries = [...storyEntries, ...discoveryEntries, ...mateEntries, ...reputationEventEntries];
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
    'updated: 2026-07-18',
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
fs.writeFileSync(path.join(root, 'src', 'data', 'codex_圖鑑資料庫.md'), codexMarkdown(allEntries), 'utf8');
console.log(`Wrote ${allEntries.length} codex entries.`);
