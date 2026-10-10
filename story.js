// ============================================================
//  守灯人：梦魇防线  —  剧情数据文件（v2 完整版）
// ============================================================

// ─── 0. 故事总纲与角色弧线 ─────────────────────────────────
// 主轴：暴雨夜断电，宿舍钟停在 03:07。三位室友去取应急灯，七分钟后回来；
// 玩家已在床上睡着，梦却把那段听不见的空白放大成一条不断延长的走廊。
// 梦魇借「第四个人失踪」制造恐惧；真正的第四个人始终是床上的玩家。
// 故事按线索递进：敲门暗号 → 值夜记录 → 缺失的七分钟 → 未听完的留言 → 主动回应。
// 真相说明发生了什么，但不替玩家解释当时的感受；结尾让玩家亲自决定如何回应。
const STORY_ARCS = [
  { id: 'night-watch', title: '床边的第四声', waves: [1, 10], question: '门外三声之后，床边那一声是谁敲的？' },
  { id: 'the-record', title: '倒放的值夜表', waves: [11, 20], question: '记录里为何有两种互相矛盾的时间？' },
  { id: 'the-empty-place', title: '空位属于谁', waves: [21, 35], question: '照片里的空位，真的是少了一个人吗？' },
  { id: 'the-lamp', title: '灯一直亮着', waves: [36, 50], question: '灯明明亮着，梦魇为什么仍不肯散去？' },
  { id: 'the-reply', title: '听完那条语音', waves: [51, 60], question: '这一次，你愿意亲口回答吗？' },
];

// 第 55 波的理解路线 × 第 60 波的最后回应，共同决定主线结尾。
// 结尾文案与 ui.js 的通关结算共用，档案页只展示已抵达的版本。
const STORY_ENDINGS = [
  { id: 'trust_heard', route: 'trust', reply: 'heard', title: '门外的笑话', text: '你轻声回答：“我听见了。你们回来了。”这一次，你没有再把归来的脚步当作敲门声。门外的雨渐渐远去，床头灯仍亮着，赵磊还欠你一个笑话。' },
  { id: 'listen_heard', route: 'listen', reply: 'heard', title: '雨声只是雨声', text: '你等到录音完整结束，才轻声回答：“我听见了。你们回来了。”静下来以后，门外的雨声终于只是雨声。醒来时，床头灯仍亮着。' },
  { id: 'trust_gratitude', route: 'trust', reply: 'gratitude', title: '灯留给了你', text: '你说：“谢谢你们把灯留给我。”周默把录音机合上，小夏笑了一下。门外那句“到了”终于不再像一场等待。' },
  { id: 'listen_gratitude', route: 'listen', reply: 'gratitude', title: '亲口说完的告别', text: '你等最后一个音节落下，才说：“谢谢你们把灯留给我。”小夏把声音放轻。录音停了，等待也停了；这一次，你亲口把告别说完。' },
];

// 视频素材按主线节点挂接到仓库相对路径；缺失或不支持时仍可读文字剧情。
const STORY_VIDEO_SLOTS = {
  wake_0307:           { title: '03:07 · 醒来', video: 'assets/story/01-wake-0307.mp4', poster: null, fallback: 'dialogue' },
  bedside_fourth:      { title: '床边的第四声', video: 'assets/story/02-bedside-fourth-knock.mp4', poster: null, fallback: 'dialogue' },
  first_return:        { title: '走廊尽头的灯', video: 'assets/story/03-hallway-lamp.mp4', poster: null, fallback: 'dialogue' },
  ledger_reversed:     { title: '倒放的值夜记录', video: 'assets/story/04-reversed-duty-log.mp4', poster: null, fallback: 'dialogue' },
  mirror_bed:          { title: '镜中空床', video: 'assets/story/05-mirror-empty-bed.mp4', poster: null, fallback: 'dialogue' },
  missing_seven:       { title: '缺失的七分钟', video: 'assets/story/06-missing-seven-minutes.mp4', poster: null, fallback: 'dialogue' },
  lamp_returns:        { title: '应急灯回来了', video: 'assets/story/07-emergency-lamp-returns.mp4', poster: null, fallback: 'dialogue' },
  looping_hallway:     { title: '循环的走廊', video: 'assets/story/08-looping-hallway.mp4', poster: null, fallback: 'dialogue' },
  unfinished_message: { title: '未听完的留言', video: 'assets/story/09-unfinished-voice-message.mp4', poster: null, fallback: 'dialogue' },
  truth_wave55:        { title: '第55波 · 真相显现', video: 'assets/story/10-wave55-truth.mp4', poster: null, fallback: 'dialogue' },
  morning_door:        { title: '门的两边', video: 'assets/story/11-two-sides-of-door.mp4', poster: null, fallback: 'dialogue' },
  rain_after:          { title: '雨停之后', video: 'assets/story/12-after-the-rain.mp4', poster: null, fallback: 'dialogue' },
};

// ─── 1. 角色档案 ───────────────────────────────────────────
// 唯一真相来源：对话框配色/头像（ui.js STORY_SPEAKERS）、角色档案面板都从这里取。
// 新增说话人时只要在这里加一条即可，不要另外在 ui.js 里再写一份。
const STORY_CHARACTERS = {
  player:   { name: '你',     icon: '🛏️', color: '#e2e8f0', glow: 'rgba(226,231,240,.08)', desc: '值夜记录里唯一没有签名的人。你总觉得自己漏听了一句话；醒来以前，先弄清那声“嗒”从哪里来。' },
  xiaxia:   { name: '林小夏', icon: '🌻', color: '#fbbf24', glow: 'rgba(251,191,36,.10)',  desc: '总把应急灯放在手边。她说话轻，记得谁怕黑，也记得有些问题不必急着追问。' },
  zhoumo:   { name: '周默',   icon: '📚', color: '#60a5fa', glow: 'rgba(96,165,250,.10)',  desc: '习惯把事情记下来的人。数字能帮他找到顺序；朋友的沉默，则需要留一点耐心。' },
  zhaolei:  { name: '赵磊',   icon: '😂', color: '#34d399', glow: 'rgba(52,211,153,.10)',  desc: '总想把笑话讲完的室友。笑话不太好笑，但他会记得谁笑过，也会记得把声音放轻。' },
  shadow:   { name: '???',    icon: '👁️', color: '#c77dff', glow: 'rgba(199,125,255,.15)', desc: '由雨声、缺失的七分钟和未播完的留言叠成。它用最像你的声音，反复问你最怕的问题。' },
  narrator: { name: '旁白',   icon: '📖', color: '#94a3b8', glow: 'rgba(148,163,184,.12)', desc: '讲述你所不知道的事。' },
  nightmare:{ name: '梦魇',   icon: '💀', color: '#ef4444', glow: 'rgba(239,68,68,.12)',   desc: '从黑暗里出现的东西，像是从某段记忆里带来的回音。' },
};

// ─── 2. 波次剧情（五幕主线；sceneId 可选配入视频）────────
const WAVE_STORY = [
  // === 第一幕：床边的第四声（Wave 1-10）===
  {
    wave: 1, speaker: '旁白', sceneId: 'wake_0307', actTitle: '第一幕 · 床边的第四声',
    text: '雨点先敲上窗，再一阵阵盖过屋里的声音。宿舍灯灭了，墙钟停在 03:07。你睁开眼时，林小夏、周默和赵磊站在床边，衣角还带着雨水。门外传来三下敲门。停顿很久，床头响起“嗒”一声——像录音机按下了停止键。三个人都望向你，谁也没有催你开口。',
    choices: [
      { text: '我是谁？这是哪里？', effect: '困惑的记忆碎片被激活' },
      { text: '管它呢，先建防御。', effect: '获得 50 金币奖励' },
    ],
  },
  {
    wave: 2, speaker: '林小夏',
    text: '你醒啦。刚才停电，我和赵磊、周默好像去了楼下。至于那盏应急灯……我记得它亮过一下，后来就想不起来了。你刚才像是在叫我？不，可能是雨声吧。',
    choices: [
      { text: '小夏？你怎么也在这？', effect: '林小夏好感度 +1' },
      { text: '快找地方躲起来！', effect: '获得 30 金币' },
    ],
  },
  {
    wave: 3, speaker: '周默',
    text: '别慌，我记下来了：门外三下，隔了很久，床头才“嗒”一声。最后那下不像敲门，更像录音机停住。本子上，三道短线后面留着一小段空白。我先记着，想起来再补——不用现在回答。',
    choices: [
      { text: '你怎么观察得这么仔细？', effect: '解锁敌人移动规律提示' },
      { text: '说得对，按你说的办。', effect: '所有炮塔本波射速 +10%' },
    ],
  },
  {
    wave: 5, speaker: '旁白',
    text: '床头墙上刻着一排日期。每个日期后面都是三道短痕，隔着一段空白，再添一道长痕。最后一道刻得很浅，像写的人怕惊动谁。末行被刮掉大半，只剩“灯……留着”，后面那几个字怎么也辨不清。',
    choices: [
      { text: '仔细查看刻痕。', effect: '解锁隐藏记忆碎片' },
      { text: '别分心，战斗要紧。', effect: '所有炮塔伤害 +5%（本波）' },
    ],
  },
  {
    wave: 6, speaker: '赵磊', sceneId: 'bedside_fourth',
    text: '我数过了，三下，然后“嗒”。我本来想讲个笑话，清了清嗓子，最后却只说：“灯在这儿，屋里的人也都在。”我把椅子往床边挪了一点。你困了就睡，等你醒了我再讲那个不太好笑的。',
    choices: [
      { text: '赵磊你能不能正经点！', effect: '赵磊好感度 +1' },
      { text: '……你这冷笑话拯救了我。', effect: '全队士气提升，金币获取 +10%' },
    ],
  },
  {
    wave: 8, speaker: '周默',
    text: '我找到那晚的值夜记录。最后一页只有“03:07”和三道往楼梯方向的墨痕。下一行被雨水洇开，像是有人写过时间，又匆匆改掉。签名那一栏空着；纸背却压着一圈灯罩的印子。',
    choices: [
      { text: '他们……怎么了？', effect: '解锁隐藏记忆碎片' },
      { text: '我们不会重蹈覆辙。', effect: '全队防御 +15%（本波）' },
    ],
  },
  {
    wave: 10, speaker: '???', actTitle: '第一幕 · 床边的第四声',
    text: '门后的不是脚步，是那晚的雨。你把墙垒得越高，敲门声就越近；你拼命守住的，好像不是出口，而是那七分钟的空白。可你还记得——三个人出门以后，究竟有没有回来？',
    choices: [
      { text: '你是谁？', effect: '触发深层梦境入口' },
      { text: '我不管，我只想睡个好觉。', effect: '床铺恢复至满血' },
    ],
  },

  // === 第二幕：倒放的值夜表（Wave 11-20）===
  {
    wave: 11, speaker: '林小夏', sceneId: 'first_return',
    text: '走廊尽头亮起一团暖黄。我把灯举高，光从指间漏出来，和床头那盏一模一样。周默说我们去过楼下，可你记得的，是先听见敲门，再看见我们站在这里。也许梦把两张纸叠反了，边角却严丝合缝。',
    choices: [
      { text: '走，去看看。', effect: '提前发现 NPC 守梦者·艾拉' },
      { text: '太危险了，先守住这里。', effect: '获得 80 金币' },
    ],
  },
  {
    wave: 13, speaker: '旁白', sceneId: 'ledger_reversed',
    text: '录音进度忽然倒退七分钟。屏幕闪过一行字：“03:07——我们下楼取灯。”再往后全是雨声。进度条走到尽头前，床头灯的影子里有个播放键一闪而过。',
  },
  {
    wave: 14, speaker: '赵磊',
    text: '周默在值夜表边画了四个圈：前三个写着名字，最后一个被墨水涂得看不清。我问他为什么不补上。他把本子合起来：“还没到能写下来的时候。”',
    choices: [
      { text: '去找周默聊聊。', effect: '解锁周默个人线分支' },
      { text: '每个人都有秘密，尊重他。', effect: '周默好感度 +1' },
    ],
  },
  {
    wave: 15, speaker: '梦魇',
    text: '门锁咔哒一声。梦魇贴着门缝低语：“三下之后，没人回答。”它模仿赵磊的声音，又在最后故意留出一截空白。“你要不要听听看，录音里真正响起的是什么？”',
    choices: [
      { text: '我不怕你们。', effect: '全军士气提升，炮塔射速 +10%' },
      { text: '……也许你说得对。', effect: '获得稀有梦境碎片' },
    ],
  },
  {
    wave: 16, speaker: '林小夏',
    text: '值夜表上有一格被折进了床垫底下。我没把纸条抽出来，只看见边角露出一个“他”字，旁边还有一道很浅的灯形压痕。小夏说，等录音播完再看。',
    choices: [
        { text: '把便条抽出来。', effect: '获得稀有梦境碎片' },
        { text: '先把便条收好，等录音播完再看。', effect: '周默好感度 +2' },
    ],
  },
  {
    wave: 18, speaker: '旁白',
    text: '梦魇们同时停下，齐齐望向床头。灯罩后的影子比刚才多出一道，轮廓却被雨水晃得支离破碎。走廊里传来录音末尾的一声“嗒”，有个影子像要转身，又停住了。',
  },
  {
    wave: 19, speaker: '周默', sceneId: 'missing_seven',
    text: '刻痕不像日期，更像一段被反复描过的流程：三道短痕，一段空白，再一道长痕。最后一组停在空白里。可墙上的钟曾短暂跳到 03:14——那多出来的七分钟，到底被谁从记录里擦掉了？',
    choices: [
      { text: '所以这是一个……循环？', effect: '解锁真相线索' },
      { text: '那我们更不能死。', effect: '全队攻击力 +10%' },
    ],
  },
  {
    wave: 20, speaker: '???',
    text: '你开始想起一盏暖黄色的灯。窗玻璃里有几道模糊的人影，其中一道被床帘切成两半。你看不清他们的脸，只看见玻璃上有一圈手环留下的雾痕；伸手擦去时，名字也跟着散了。',
    choices: [
      { text: '我记得阳光的味道。', effect: '解锁 NPC"守梦者·艾拉"' },
      { text: '梦境就是我的现实。', effect: '梦境力量觉醒，全属性 +8%' },
    ],
  },

  // === 第三幕：空位属于谁（Wave 21-35）===
  {
    wave: 21, speaker: '赵磊',
    text: '我刚才又梦见楼梯了。雨太大，灯一闪一闪的。我记得自己有件事没做完，好像答应过谁讲完一个笑话。可梦里的钟总在倒着走，我每次快想起来时，都会听见门后有人敲三下。',
    choices: [
      { text: '你是不是还有话没讲完？', effect: '赵磊留下未完成的线索' },
      { text: '别说了，我不想听。', effect: '获得 100 金币' },
    ],
  },
  {
    wave: 22, speaker: '旁白',
    text: '灯闪了一下。记录多出一行湿字：“别替门里的人回答。”赵磊把纸翻过去，背面又浮出：“他听得见吗？”你想开口，声音却从床头录音机里先一步传出来——像有人把尚未发生的话也录了进去。',
  },
  {
    wave: 23, speaker: '林小夏',
    text: '周默去镜子前核对人数，留下纸条：“别数走廊里的影子，数值夜表上的名字。”纸条背面有一道被划掉的补记，只剩“名单之外……”几个字。墨迹还没干，像刚有人把后半句擦掉。',
    choices: [
      { text: '我们必须去找他！', effect: '提前进入深层梦境' },
      { text: '……听他的话，留在这里。', effect: '获得周默遗留笔记，全属性 +12%' },
    ],
  },
  {
    wave: 25, speaker: '???',
    text: '镜子里的你慢了一拍。你抬手，镜中人却望向了别处。镜面深处像有谁睁开眼，很快又被一层水汽遮住。雨声忽然远了，房间里只剩两种节奏相近的呼吸。玻璃上浮出一句话：别把没听见，当成没有发生。',
    choices: [
      { text: '面对内心。', effect: '直面心魔，全属性 +8%（本局）' },
      { text: '闭嘴！', effect: '暴怒状态：全炮塔暴击率 +15%' },
    ],
  },
  {
    wave: 26, speaker: '旁白', sceneId: 'looping_hallway',
    text: '走廊像旧胶片一样抖动了一下。每扇门牌都变成 03:07。数字恢复后，最远那扇门开了一条缝；门外似乎是同一间宿舍，暖光照着床头，可镜头在看清人影前突然烧成一片白。',
  },
  {
    wave: 27, speaker: '赵磊',
    text: '我想起那张合照了。照片上有几个人影围着一团白色，边缘被水泡得发皱。背面写着几个名字，其中一处被墨迹盖住。赵磊把照片翻来覆去看了很久，最后只说：“这笔迹，我好像认得。”',
    choices: [
      { text: '先把照片收好，等线索补齐再看。', effect: '赵磊留下未完成的线索' },
      { text: '不必现在下结论，我相信你们。', effect: '全队获得「羁绊之力」，全属性 +20%' },
    ],
  },
  {
    wave: 28, speaker: '林小夏',
    text: '我找到那段语音了，但它只剩开头和一长段雨声。周默说了“03:07”，后面像有人提到一盏灯；赵磊的声音刚要响起，录音便跳回起点。我不敢替你补上缺掉的那句话。',
    choices: [
      { text: '我……不知道该说什么。', effect: '理解加深，全属性 +5%（本局）' },
      { text: '对不起。', effect: '林小夏、周默、赵磊好感度 +10' },
    ],
  },
  {
    wave: 29, speaker: '旁白', actTitle: '第三幕 · 空位属于谁',
    text: '[值夜记录 · 03:07]\n停电：已确认。\n楼梯：三道向下的水痕。\n时间：03:07 → 03:14。\n中间一行被雨水泡开，只剩一个“嗒”字。\n备注：灯罩上有新的指纹。\n签名栏：空白。',
  },
  {
    wave: 30, speaker: '梦魇',
    text: '走廊尽头挂着“出口”的牌子。风把它吹得转了一圈，背面写着“再等一会儿”。几道湿鞋印从楼梯口延伸到一扇看不见的门前，忽然断掉。门后的声音说：“只要继续等，你就不用听最后一句。”那声音像你，却比你更早知道结尾。',
    choices: [
      { text: '我要醒来。', effect: '清醒决意，全属性 +10%（本局）' },
      { text: '再睡五分钟……', effect: '床铺回满，全属性 +5%（本局）' },
    ],
  },
  {
    wave: 32, speaker: '周默',
    sceneId: 'mirror_bed', actTitle: '第三幕 · 空位属于谁',
    text: '我把本子合上，又打开，像是怕那行字会消失。“03:07，停电。03:14，灯亮。”中间那一栏被整齐地撕走了。镜子里的人影时多时少；最后的“嗒”究竟是门锁、钟摆，还是录音机，我还不能确定。',
    choices: [
      { text: '把镜中的变化记下来，之后再核对。', effect: '周默记下镜中的变化' },
      { text: '先核对时间，等录音播完再判断。', effect: '周默记下缺失的时间' },
    ],
  },
  {
    wave: 34, speaker: '旁白',
    text: '你把手从门把上收回来。门外传来椅脚轻轻挪动的声音，接着是纸页翻动，又归于安静。你没有再急着替沉默下结论，只把耳朵贴近门板，想分辨那声“嗒”从哪边传来。',
  },
  {
    wave: 35, speaker: '???',
    text: '一段模糊的词音在录音里反复出现，每次都少一个音节。门没有立刻打开，梦魇也没有消失。你听见梦里的自己还在说“再等七分钟”，声音越来越小。也许那只是梦里反复播放的一句旧话。',
    choices: [
      { text: '自己走回去。', effect: '自己走回去，全属性 +10%（本局）' },
      { text: '再等一下……', effect: '床铺回满，全属性 +5%（本局）' },
    ],
  },

  // === 第四幕：灯一直亮着（Wave 36-50）===
  {
    wave: 38, speaker: '赵磊',
    text: '我决定把那个笑话讲完。为什么闹钟总慢七分钟？因为它也想多睡一会儿。……我知道，还是很烂。说到最后，我忽然忘了笑点，只听见雨声里混进一小段模糊的笑声。它很快被雷声盖住，我和小夏都没能听清。',
    choices: [
      { text: '永远记得。', effect: '赵磊化为最后一道防线（永久护盾 +500）' },
      { text: '谢谢你，赵磊。', effect: '全队获得「幽默之力」，暴击率 +20%' },
    ],
  },
  {
    wave: 40, speaker: '林小夏',
    text: '那晚我一直记得一盏灯。它明明很亮，照到走廊尽头时却像隔着一层雾。后来我常想，是不是有人在灯亮起来时说过什么；可每次想追上那句话，梦就把钟拨回 03:07。',
    choices: [
      { text: '你是说……这不是白费的？', effect: '全属性 +15%，解锁「成长」成就' },
      { text: '现实里又没有梦魇。', effect: '获得 200 金币' },
    ],
  },
  {
    wave: 42, speaker: '周默',
    text: '我总觉得，只要把时间写清楚，事情就不会走样。可那晚我只顾着盯钟，差点连赵磊讲到一半的笑话都忘了。现在我想起了一个尾音，却想不起它前面那句话。录音机上的“嗒”每次都恰好落在空白处。',
    choices: [
      { text: '理解……恐惧的根源？', effect: '理解恐惧，全属性 +10%（本局）' },
      { text: '听不懂，但听起来很厉害。', effect: '全炮塔伤害 +25%' },
    ],
  },
  {
    wave: 45, speaker: '旁白',
    text: '黑暗里有几道人影停在灯光边缘。一道轮廓在镜中被拉长，又被水汽慢慢抹去。你快要看清时，灯光闪了一下；再亮起时，镜面只剩下模糊的雨痕。',
  },
  {
    wave: 48, speaker: '林小夏', sceneId: 'lamp_returns',
    text: '我把应急灯放在窗边，光刚好落在一角旧布上。这个动作让我觉得熟悉，可我想不起在哪做过。录音还剩最后一段；等你准备好，我们再一起核对，不必现在猜它的意思。',
    choices: [
      { text: '我们一起守住这盏灯。', effect: '同伴支持：全属性 +25%，持续到结局' },
      { text: '最后的战斗，交给我。', effect: '单人模式：攻击力 x2，但防御 -50%' },
    ],
  },
  {
    wave: 50, speaker: '赵磊',
    text: '我终于把那个笑话讲完了，还是不怎么好笑。结尾那几个音节被雨声搅在一起，听起来像“到了”，也可能完全不是。我不等你立刻回答；想再听一次，我可以从头讲。',
    choices: [
      { text: '我会的。', effect: '赵磊永久记忆锁定' },
      { text: '把最后一句也留到以后。', effect: '记下赵磊没讲完的笑话' },
    ],
  },
  // === 第五幕：听完那条语音（Wave 51-60）===
  {
    wave: 52, speaker: '周默', sceneId: 'unfinished_message',
    text: '我把录音机放在桌上，手指停在播放键旁。开头是雨声和脚步，后半段断断续续，暂时听不清。我不会替你按下去。你准备好时再按；标签上写着：等雨停再听。',
    choices: [
      { text: '数学不会骗人。', effect: '周默留下最终计算结果' },
      { text: '概率不是命运。', effect: '全属性 +20%' },
    ],
  },
  {
    wave: 55, speaker: '???', sceneId: 'truth_wave55', actTitle: '第五幕 · 听完那条语音',
    text: '录音机终于越过停在 06:59 的位置。先是周默的声音：“03:07，停电。我们下楼去拿灯。”七分钟的雨声后，小夏说：“03:14，灯放回床头了。他睡着了，别叫醒他。”赵磊压低声音：“那就让他睡吧，明天我再把笑话讲完。”\n\n你想起来了：那三下不是有人求救，是他们回来时轻轻敲的门。床头那声“嗒”只是录音机停止。三个人没有失踪，他们回来了；那晚你已经睡着，没听见最后一句。宿舍里从来没有少第四个人——你一直在床上。梦魇把你没听见的七分钟拉成一条走廊，让你以为他们还在门外。',
    choices: [
      { text: '原来你们回来了……我听见了。', effect: '恐惧转化为力量，全属性 +30%', storyRoute: 'trust' },
      { text: '让我把留言听完，再亲口回答。', effect: '获得「无畏」状态，免疫所有控制效果', storyRoute: 'listen' },
    ],
  },
  {
    wave: 58, speaker: '旁白',
    text: '录音走到最后。雨声，楼梯上的脚步，周默说“灯放好了”，小夏说“他睡着了”。赵磊轻轻笑了一下：“那就让他睡吧。”停止键响起“嗒”。这一次，那个声音只是停止键。你没有听见梦替你说话。',
  },
  {
    wave: 60, speaker: '林小夏', sceneId: 'morning_door', actTitle: '第五幕 · 亲口回答',
    text: '留言播完，门外安静下来。我和周默、赵磊把应急灯放回床头。记录最后一行显出来：“床边三人，床上一人——四人已齐。”我没有催你开门，只想问：“如果这次由你来回答，你想说什么？”',
    choices: [
      { text: '我听见了。你们回来了。', effect: '最终 BOSS 战全属性 +50%', endingReply: 'heard' },
      { text: '谢谢你们把灯留给我。', effect: '全队羁绊之力爆发，最终 BOSS 战全属性 +100%', endingReply: 'gratitude' },
    ],
  },
];

// ─── 2. BOSS 对话（增强版）─────────────────────────────────
const BOSS_DIALOG = {
  abyss: {
    wave: 10,
    name: '深渊巨口',
    icon: '🦑',
    intro: '你把门修得这么牢，是怕雨进来，还是怕听见门外那阵一直没听清的声音？',
    phase1: '三下。停。别按播放键。',
    phase2: '雨声会一直响，直到你忘了自己在等谁。',
    phase3: '只要不听最后一句，这场梦就能一直停在这里。',
    defeat: '黑暗退回门后。地上留下三双潮湿的鞋印，尽头的录音机亮起一格电量。',
    personality: '由暴雨、门后的等待和未完成的录音构成，专挑玩家最不敢确认的时刻发问',
  },
  machine: {
    wave: 15,
    name: '机械核心',
    icon: '🛰️',
    intro: '记录开始。03:07，时间戳出现偏差。之后七分钟，录音里只有雨。缺失的一栏，你打算先记成什么？',
    phase1: '时间戳冲突：03:07。',
    phase2: '检测到七分钟空白。',
    phase3: '错误：播放结束前，禁止提交结论。',
    defeat: '机械停了。进度条往前跳了一格，雨声里似乎多出一段脚步，又很快被静电盖住。',
    personality: '把记录缺页当作失踪证据的旧录音机，重复错误时间直到有人重新核对',
  },
  void: {
    wave: 20,
    name: '虚空之影',
    icon: '🌑',
    intro: '镜子里有几道影子总比你慢半拍。你确定那只是反光吗？',
    phase1: '别数站着的人。',
    phase2: '镜面深处有一道影子刚才动了。',
    phase3: '你看见了什么，却不敢确认那是谁。',
    defeat: '影子没有消失。它退回镜面后，只留下一个被水汽遮住的名字。',
    personality: '不断改变镜中影子的数量和位置，让玩家追逐无法确认的空白',
  },
  lord: {
    wave: 25,
    name: '梦魇领主',
    icon: '😈',
    intro: '我没有藏起任何东西。我只把你不敢听的七分钟，拉得再长一点。',
    phase1: '你说过“我没事”。',
    phase2: '你以为门外没有人回答。',
    phase3: '如果门真的打开，你准备好回应了吗？',
    defeat: '它跪倒在地，身体化作一段尚未播放的波形。波形尽头，有三个人的声音。',
    personality: '不靠编造怪物取胜，而是不断把等待解释成离别，阻止玩家听完留言',
  },
  final: {
    wave: 60,
    name: '终焉梦魇',
    icon: '👁️‍🗨️',
    intro: '最后一段不是怪物的声音。那只是你一直没听完的录音。',
    phase1: '03:07。我们下楼去拿灯。',
    phase2: '03:14。我们回来了，你已经睡着。',
    phase3: '播放键就在这里。接下来的回答，不能由梦替你说。',
    defeat: '雨声结束。周默说：“灯放好了。”小夏说：“让他睡吧。”赵磊按下停止键。床头灯亮着，门没有再敲；窗外的天色一点点变浅。',
    personality: '由七分钟的空白和对回应的迟疑凝成；它把“还没回来”重复成循环，好让玩家不必面对录音结束后的安静',
  },
};

// ─── 3. 梦境碎片 ───────────────────────────────────────────
const DREAM_FRAGMENTS = [
  { id:'frag_1', title:'失眠的夜晚', desc:'凌晨三点的失眠', icon:'🌙', rarity:'common',
    text:'凌晨三点，你盯着天花板数绵羊。数到第一百只的时候，你意识到它们都长着你的脸。' },
  { id:'frag_2', title:'闹钟的诅咒', desc:'醒不来的循环', icon:'⏰', rarity:'common',
    text:'闹钟响了。你伸手去按，手指穿过了它。你还在梦里。今天是周几？你已经不记得了。' },
  { id:'frag_3', title:'床边的合照', desc:'照片里被遮住的轮廓', icon:'📷', rarity:'common', revealWave:55,
    text:'三个室友站在床边，第四个人被被子盖住，只露出戴着手环的手。背面写着：灯放好了。' },
  { id:'frag_4', title:'七分钟录音', desc:'03:07 到 03:14', icon:'📱', rarity:'common', revealWave:55,
    text:'录音前段是雨声和下楼的脚步，结尾有人说“灯拿回来了”。停止键轻响一下，听起来像第四次敲门。' },
  { id:'frag_5', title:'空教室', desc:'独自面对', icon:'🏫', rarity:'common',
    text:'考试铃响了，但教室里只有你一个人。试卷上的题目你从未学过，而窗外是无尽的黑夜。' },
  { id:'frag_6', title:'追逐', desc:'逃不掉的恐惧', icon:'🏃', rarity:'common',
    text:'你在跑，身后有什么东西在追。你看不清它，但你知道——它没有形状，因为它就是"恐惧"本身。' },
  { id:'frag_7', title:'镜中的床', desc:'影子里的人数', icon:'🪞', rarity:'common', revealWave:55,
    text:'镜子里三个人站着，一个人躺着。床上的影子抬起手，手环上的名字和你的一样。' },
  { id:'frag_8', title:'消失的房间', desc:'回不去的地方', icon:'🚪', rarity:'rare',
    text:'你回到童年的卧室，但一切都缩小了。书桌上的作业本翻开——上面写满了同一个字："逃"。' },
  { id:'frag_9', title:'失声', desc:'发不出的声音', icon:'🔇', rarity:'rare',
    text:'你想呼救，但嘴巴一张一合，发不出任何声音。你周围的人都在正常地说话、笑，没有人注意到你。' },
  { id:'frag_10', title:'倒流的河', desc:'逆转的时间', icon:'🌊', rarity:'rare',
    text:'河水向上游流去。岸边的树在倒着长，落叶飞回枝头。时间在倒退——但只有你注意到了。' },
  { id:'frag_11', title:'永恒的走廊', desc:'走不到尽头', icon:'🏛️', rarity:'rare',
    text:'走廊没有尽头。每扇门后面都是另一条走廊。你开始怀疑——也许"出口"这个概念本身就是个梦。' },
  { id:'frag_12', title:'值夜表的第四格', desc:'不是空白，是一张床', icon:'📝', rarity:'rare', revealWave:55,
    text:'前三格写着三个名字，第四格画着一张床。旁边的备注是：他睡着了，别叫醒他。' },
  { id:'frag_13', title:'灯下的压痕', desc:'没有寄出的留言', icon:'📄', rarity:'rare', revealWave:55,
    text:'斜光照过空白便笺，浮出两行字：“我们去拿灯，很快回来。”“到了，别叫醒他。”' },
  { id:'frag_14', title:'最后一课', desc:'未完的告别', icon:'📝', rarity:'epic',
    text:'老师说："人生的考试没有标准答案。"你醒了，发现自己泪流满面，但想不起为什么。' },
  { id:'frag_15', title:'碎片拼图', desc:'拼凑的自己', icon:'🧩', rarity:'epic', revealWave:55,
    text:'你把记忆碎片拼在一起，看到无数面镜子围着一张床。每面镜子里都有一个不同年纪的人，唯独床边留着一道空白。' },
  { id:'frag_16', title:'没寄出的便笺', desc:'写给睡着的那个人', icon:'📨', rarity:'epic', revealWave:55,
    text:'灯罩底下压着一张折过两次的纸：“醒来后别急着道歉。灯我放回来了，笑话还欠你一个结尾。”没有署名，但最后那个歪歪扭扭的字，一看就是赵磊写的。' },
  { id:'frag_17', title:'第一道光', desc:'从未到达的黎明', icon:'🌅', rarity:'legendary', revealWave:55,
    text:'所有梦魇的尽头有一扇小窗。窗外没有黎明，只有一盏亮着的走廊灯，和一双停在门外的鞋。' },
  { id:'frag_18', title:'闹钟', desc:'梦的终结者', icon:'🔔', rarity:'legendary',
    text:'闹钟。很简单的一个闹钟。但在梦境里，它是一个禁忌之物。因为闹钟意味着——梦要结束了。' },
  { id:'frag_19', title:'03:14', desc:'灯回到了床头', icon:'🔔', rarity:'legendary', revealWave:55,
    text:'闹钟停在 03:07。七分钟后，三双湿鞋印走回床边。床头灯亮着，屋里四个人，一个也没有少。' },
  { id:'frag_20', title:'写给自己的信', desc:'来自内心的声音', icon:'💌', rarity:'legendary', revealWave:55,
    text:'"亲爱的我：如果你读到这里，先别相信写信的人。问问他，03:07 那时他在哪里。答案就在你记得最清楚、却一直不肯说的地方。"' },
  // ── 追加 10 块碎片：继续沿着 03:07 停电、七分钟缺口、第四双鞋的线索往下挖 ──
  { id:'frag_21', title:'走廊的第四双鞋', desc:'门口多出来的那道水痕', icon:'👟', rarity:'common', revealWave:55,
    text:'门口摆着三双湿鞋，鞋尖朝外，像是随时准备再出去一次。第四道水痕从楼梯口一路拖到床边，却没有对应的鞋。' },
  { id:'frag_22', title:'备用灯的电量', desc:'只亮过七分钟', icon:'🔋', rarity:'common',
    text:'应急灯的指示灯还剩三格电。说明书上写着满电可连续照明两小时。它只亮过七分钟，却耗掉了第一格。' },
  { id:'frag_23', title:'手环上的名字', desc:'和你的一模一样', icon:'⌚', rarity:'rare', revealWave:55,
    text:'照片里那只手环的腕带上刻着名字。你把照片放大到发虚，才敢承认那三个字和你的一模一样。' },
  { id:'frag_24', title:'值夜表的背面', desc:'被写过又擦掉', icon:'📋', rarity:'rare', revealWave:55,
    text:'纸背有很深的压痕，是写字时用力留下的。逆着光读出来只有一行："第四格不用填，他一直在。"' },
  { id:'frag_25', title:'没有发出去的短信', desc:'草稿箱里的一行字', icon:'✉️', rarity:'rare',
    text:'草稿箱里躺着一条没发出去的消息，收件人是那个三个人的群。只有两个字："别关灯。"发送时间停在 03:07。' },
  { id:'frag_26', title:'雨声里的另一层', desc:'多出来的那个呼吸', icon:'🌧️', rarity:'epic', revealWave:55,
    text:'把录音降速到一半，雨声底下浮出第四个人的呼吸。它比雨声更慢，也比屋里的三个人更近。' },
  { id:'frag_27', title:'床垫下的纸条', desc:'写给下一个醒着的人', icon:'📃', rarity:'epic', revealWave:55,
    text:'纸条上只有一句："如果你读到这里，说明轮到你了。把灯留着，别应门。"字迹很新，墨还没完全干。' },
  { id:'frag_28', title:'第四格的名字', desc:'被雨水泡开的墨迹', icon:'🖋️', rarity:'epic', revealWave:55,
    text:'值夜表的第四格被雨水泡过，墨迹散成一团。但在紫外灯下还能看出一个偏旁 —— 和你自己的姓，是同一个。' },
  { id:'frag_29', title:'录音的最后一秒', desc:'一直没有播完的那一段', icon:'▶️', rarity:'legendary', revealWave:55,
    text:'进度条走到 06:59 就断了。你把缺的那零点几秒补上，听见有人轻轻把门带上，然后对着床铺说了一句："我们回来了。"' },
  { id:'frag_30', title:'醒来的第一句话', desc:'最后一块碎片', icon:'🌅', rarity:'legendary', revealWave:55,
    text:'三十块碎片拼在一起，拼出的不是答案，是一张床和三个站在床边的人。天快亮了。你说出的第一句话，决定了这盘录音要不要倒回去重听。' },
];

// ─── 4. NPC 台词 ───────────────────────────────────────────
const NPC_DIALOG = [
  {
    id: 'npc_1', name: '守梦者·艾拉', role: '治疗师', icon: '🌙', abilityId: 'healer_npc',
    intro: '你终于走到这盏灯下面。别急着找出口，先看看灯照到谁。迷路的人可以在这里停一会儿。',
    stationed: '每秒为房间内的建筑恢复 15 点生命。我会守护你的防线，直到你找到回家的路。',
    quest: '在第 20 波之前，保持三扇铁门全部完好。能做到的话，就算你通过了我的考验。',
  },
  {
    id: 'npc_2', name: '记忆商人·摩伊拉', role: '道具商', icon: '🧶', abilityId: 'merchant',
    intro: '每段记忆都有线头。你交出一段，就能换回另一段；只是失去的部分，也会留下形状。',
    stationed: '每波结束额外获得 80 金币。生意人总会找到赚钱的方式。',
    quest: '收集 10 个梦境碎片。它们凑在一起时，会自己讲故事。',
  },
  {
    id: 'npc_3', name: '梦行者·凯恩', role: '斥候', icon: '👁️', abilityId: 'scout',
    intro: '嘘，听走廊。它会把脚步声重复给你听，我能认出哪一段是回声，哪一段是原声。先听完，再决定要不要相信。',
    stationed: '揭示房间内的隐形梦魇，让它们无所遁形。知己知彼。',
    quest: '在不使用任何技能的情况下清空一波敌人。静默，是最强的武器。',
  },
  {
    id: 'npc_4', name: '铁匠·赫淮斯托斯的残影', role: '强化师', icon: '🔨', abilityId: 'warrior_npc',
    intro: '我只是灯影里的一点残火。真正的铁匠早已走远，不过我还记得，怎么把裂开的东西敲回能用的样子。',
    stationed: '房间内炮塔伤害 +18%。残影的力量虽弱，但足够锋利。',
    quest: '将任意一座建筑转职。让我看看你的决心。',
  },
  {
    id: 'npc_5', name: '低语者·奈亚', role: '情报员', icon: '🌀', abilityId: 'frost_mage',
    intro: '你在找门后面的敌人？它有时长着你的脸，有时长着别人的。看你怎么对待它，它就会记住那个样子。',
    stationed: '房间内的梦魇减速 25%。慢下来的敌人，看得更清。',
    quest: '击败一只带有 3 个词缀的精英敌人。那场面会很美。',
  },
  {
    id: 'npc_6', name: '守床人·阿尔忒弥斯', role: '守护者', icon: '🏹', abilityId: 'guardian',
    intro: '床边的影子很小，常常被忽略。我的职责是守住它，直到你愿意为这段记忆找到名字。',
    stationed: '每秒为床铺与铁门补充 40 点护盾。只要床还在，希望就在。',
    quest: '在床铺生命低于 10% 的情况下存活 3 波。绝境，是最好的老师。',
  },
];

// ─── 5. 梦中梦数据 ─────────────────────────────────────────
// 唯一真相来源：dream.js 的 DeepDream.DEEP_LEVELS 直接由这张表生成，波次/时长/数值都只在这里改。
// rules 文案必须与 modifier 里的真实数值一致（否则玩家看到的规则和游戏行为会打架）。
const DEEP_DREAM_LEVELS = [
  {
    id: 'deep_1', triggerWave: 15, duration: 3, name: '记忆走廊', icon: '🏛️',
    description: '你坠入了更深层的梦境。这里是一条没有尽头的走廊，两侧的墙上挂满了你遗忘的记忆。',
    rules: '梦魇生命 ×1.5、速度 ×1.2，并对火焰额外脆弱（弱点 +30%）；你的炮塔伤害降低 10%。时间流速不变。',
    goal: '在深层梦境中存活 3 波，即可带着记忆返回浅层。',
    reward: '30 灵魂 + 稀有符文 ×1',
    rewardSpec: { souls: 30, rune: 'rare' },
    modifier: {
      enemyBuffs: { hpMul: 1.5, spdMul: 1.2 },
      enemyNerfs: { fire: 0.3 },
      buildingBonus: { dmgMul: 0.9 },
      timeScale: 1.0,
    },
  },
  {
    id: 'deep_2', triggerWave: 30, duration: 3, name: '镜像迷宫', icon: '🪞',
    description: '无数面镜子组成的空间。每一面镜子里都是另一个版本的你——有的在哭，有的在笑，有的在尖叫。',
    rules: '梦魇生命 ×2.0、速度 ×0.8，全抗性 +20%，并对电磁额外脆弱（弱点 +40%）；你的炮塔射速 +15%，时间流速变慢（×0.85）。',
    goal: '在深层梦境中存活 3 波。镜子很多，但只有一个你。',
    reward: '60 灵魂 + 史诗符文 ×1',
    rewardSpec: { souls: 60, rune: 'epic' },
    modifier: {
      enemyBuffs: { hpMul: 2.0, spdMul: 0.8, resAll: 0.2 },
      enemyNerfs: { shock: 0.4 },
      buildingBonus: { rateMul: 1.15 },
      timeScale: 0.85,
    },
  },
  {
    id: 'deep_3', triggerWave: 45, duration: 3, name: '意识深渊', icon: '🕳️',
    description: '最底层的梦境。这里没有固定形状和颜色，只有像潮水一样起伏的意识。远处偶尔浮现熟悉的轮廓，却无法确认它来自记忆，还是正在发生。',
    rules: '梦魇生命 ×2.8、攻击 ×1.5，并对能量额外脆弱（弱点 +50%）；你的炮塔伤害 +20%、射速 +10%，时间流速加快（×1.15）。',
    goal: '在深层梦境中存活 3 波。听清回声的方向，再决定下一步。',
    reward: '100 灵魂 + 传说符文 ×1',
    rewardSpec: { souls: 100, rune: 'legendary' },
    modifier: {
      enemyBuffs: { hpMul: 2.8, spdMul: 1.1, dmgMul: 1.5 },
      enemyNerfs: { energy: 0.5 },
      buildingBonus: { dmgMul: 1.2, rateMul: 1.1 },
      timeScale: 1.15,
    },
  },
];

// ─── 6. 第四面墙数据 ───────────────────────────────────────
// 唯一真相来源：dream.js 的 FourthWall.WAVE_EVENTS 直接读取这张表（不再各写一份）。
// 字段约定必须与 FourthWall.applyEffect 一致：
//   type:  'fakeCrash' | 'uiCorrupt' | 'chatMessage' | 'saveCorrupt'
//   params.uiCorrupt: 'goldInvert' | 'buttonReplace' | 'colorInvert' | 'glitch'
//   content: 展示给玩家的完整文案（可含 \n，聊天框按原样换行显示）
const FOURTH_WALL_EVENTS = [
  {
    wave: 7, type: 'chatMessage', title: '低语',
    params: { msg: '你以为这样就能挡住我？' },
    content: '你以为这样就能挡住我？\n\n（声音来自墙壁里面。）\n别担心，这不是真的。继续吧。',
  },
  {
    wave: 13, type: 'uiCorrupt', title: '数据错乱',
    params: { type: 'goldInvert' },
    content: '金币数字开始倒着跳动。\n建筑图标短暂变成 ASCII 字符。\nHUD 上闪过一行字："有人在看着你。"',
  },
  {
    wave: 18, type: 'chatMessage', title: '未知玩家',
    params: { msg: '你也听见 03:07 的钟声了吗？' },
    content: '[系统] 玩家 "空座位" 已加入房间。\n[空座位] 你也听见 03:07 的钟声了吗？\n[系统] 玩家 "空座位" 已离开房间。',
  },
  {
    wave: 22, type: 'saveCorrupt', title: '缺页的记录',
    params: {},
    content: '索引读取异常。\n记录：03:07\n房间人数：三\n空床数量：一\n\n最后一行被反复擦去，只剩下一个问号。',
  },
  {
    wave: 26, type: 'uiCorrupt', title: '像素化',
    params: { type: 'glitch' },
    content: '整个画面像旧胶片一样抖动。\n走廊尽头的门牌变成了 03:07。\n门后有人写下一行字：\n"这扇门记得你。"',
  },
  {
    wave: 29, type: 'chatMessage', title: '脑电波异常',
    params: { msg: '记录里少了一个名字。' },
    content: '[值夜记录] 时间：03:07\n[值夜记录] 床铺：有人\n[值夜记录] 床边：三人\n[值夜记录] 走廊尽头：有人回应\n[值夜记录] 请勿开门。',
  },
  {
    wave: 30, type: 'fakeCrash', title: '梦境崩溃',
    params: {},
    content: '梦境遇到了问题，需要重新启动。\n错误代码：REALITY_NOT_FOUND\n\n你闭上了眼睛。\n你睁开了眼睛。\n哪个是真的？',
  },
  {
    wave: 37, type: 'chatMessage', title: '崩塌',
    params: { msg: '梦境正在崩塌……你感觉到了吗？' },
    content: '梦境正在崩塌……你感觉到了吗？\n\n走廊尽头的那面镜子，裂开了一道缝。',
  },
  {
    wave: 43, type: 'saveCorrupt', title: '幽灵存档',
    params: {},
    content: '检测到一份不属于本局的存档。\n写入时间：你第一次做这个梦的那天。\n\n它还在那里。',
  },
  {
    wave: 49, type: 'fakeCrash', title: '循环',
    params: {},
    content: '梦境遇到了问题，需要重新启动。\n错误代码：DREAM_LOOP\n\n你以为你在前进吗？\n墙上的刻痕，比昨晚又多了一道。',
  },
  {
    wave: 55, type: 'uiCorrupt', title: '褪色',
    params: { type: 'colorInvert' },
    content: '世界失去了颜色。\n只剩下你和它们，在灰白的走廊里。\n\n第四面墙在变薄。',
  },
  {
    wave: 59, type: 'chatMessage', title: '告别',
    params: { msg: '下一声钟响之后，记得自己回答。' },
    content: '下一声钟响之后，记得自己回答。\n\n（这次它没有笑。）',
  },
];

// ─── 7. 不战而胜数据 ───────────────────────────────────────
const MERCY_ENCOUNTERS = [
  {
    enemyType: 'grunt', name: '迷失的梦魇', icon: '😶',
    dialogue: '……我忘了自己是谁了。我只记得害怕。你能帮帮我吗？',
    reward: '获得 30 金币 + 5 灵魂。',
    unlock: null,
  },
  {
    enemyType: 'phantom', name: '孤独的幽灵', icon: '👻',
    dialogue: '我不想吓人……我只是想被看见。所有人看到我都会跑。',
    reward: '获得 20 灵魂。幽灵消散时留下一圈温柔的光。',
    unlock: null,
  },
  {
    enemyType: 'healer', name: '自愈的梦魇', icon: '💚',
    dialogue: '我在治愈别人，但没有人治愈我。这很公平吗？',
    reward: '获得「共情之力」：建筑生命 +15%（本局）。',
    unlock: null,
  },
  {
    enemyType: 'splitter', name: '碎片化的自我', icon: '💔',
    dialogue: '每次被打败，我就会碎成更小的自己。我已经不记得完整的我是什么样子了。',
    reward: '获得 40 灵魂 + 稀有梦境碎片 ×1。',
    unlock: 'achievement_puzzler',
  },
  {
    enemyType: 'summoner', name: '孤独的召唤者', icon: '🌀',
    dialogue: '我召唤同伴，不是为了攻击……是因为太孤独了。你懂吗？',
    reward: '该波不再召唤额外敌人。获得稀有梦境碎片 ×1。',
    unlock: null,
  },
  {
    enemyType: 'vampire', name: '饥渴的吸血者', icon: '🧛',
    dialogue: '我不是想伤害你。我只是……饿。在梦境里，饥饿永远不会停止。',
    reward: '获得「不朽之血」：床铺每秒恢复 2 点生命（永久，本局）。',
    unlock: null,
  },
  {
    enemyType: 'berserker', name: '愤怒的孩子', icon: '😤',
    dialogue: '我恨这个世界！我恨所有——等等……你为什么不跑？',
    reward: '该敌人平静下来。获得 50 金币 + 10 灵魂。',
    unlock: 'hidden_dialogue_calm',
  },
  {
    enemyType: 'wraith', name: '被遗忘的怨灵', icon: '👤',
    dialogue: '……有人记得我的名字吗？哪怕一个人也好。我等了好久好久。',
    reward: '获得「记忆之锚」：被摧毁的建筑有 20% 概率自动重建（本局）。',
    unlock: 'hidden_ending',
  },
];

// ─── 8. 声音旋律数据 ───────────────────────────────────────
const SOUND_MELODIES = [
  {
    id: 'melody_1', name: '安眠曲', icon: '🎵',
    sequence: ['bed', 'repair', 'shield'],
    hint: '床铺……修复……守护……',
    reward: '床铺回复至满血，获得 50 金币。',
    rewardSpec: { healBed: true, gold: 50 },
    story: '一段模糊的旋律在脑海中响起——是妈妈唱过的摇篮曲。你已经很久没有想起这首歌了。',
  },
  {
    id: 'melody_2', name: '战鼓', icon: '🥁',
    sequence: ['turret', 'tesla', 'laser'],
    hint: '子弹……闪电……光束……',
    reward: '所有炮塔伤害 +20%（持续 2 波）。',
    rewardSpec: { dmgMul: 1.2, waves: 2 },
    story: '炮塔的射击声汇成了一首进行曲。这不是战争的喧嚣——是你第一次鼓起勇气开口说话时的心跳。',
  },
  {
    id: 'melody_3', name: '摇钱树之歌', icon: '💰',
    sequence: ['miner', 'generator', 'bank'],
    hint: '挖掘……能量……积累……',
    reward: '获得 200 金币 + 10 灵魂。',
    rewardSpec: { gold: 200, souls: 10 },
    story: '金币碰撞的声音像风铃。你想起了小时候存零花钱买第一本书的那个下午。',
  },
  {
    id: 'melody_4', name: '冰与火之歌', icon: '❄️',
    sequence: ['frost', 'flame', 'frost'],
    hint: '冰……火……冰……',
    reward: '触发元素共鸣：全场梦魇受到一次冰霜 + 火焰双重伤害。',
    rewardSpec: { nova: { frost: 90, fire: 90 } },
    story: '冰霜与火焰交织的瞬间，你看到了一幅画面——冬天的壁炉前，你在读一本关于冒险的书。',
  },
  {
    id: 'melody_5', name: '引力之舞', icon: '🌀',
    sequence: ['gravity', 'amp', 'tesla'],
    hint: '引力……增幅……电弧……',
    reward: '触发「奇点风暴」：全场梦魇被引力定身 3 秒，并受到一次能量伤害。',
    rewardSpec: { storm: { stun: 3, energy: 120 } },
    story: '宇宙的运转有它的韵律。你忽然理解了——噩梦也有它存在的理由。',
  },
  {
    id: 'melody_6', name: '创世之音', icon: '🌟',
    sequence: ['generator', 'amp', 'laser', 'shield', 'bed'],
    hint: '能量……增幅……毁灭……守护……归宿……',
    reward: '全回复 + 全炮塔超频 15 秒 + 获得传说碎片 ×1。',
    rewardSpec: { healAll: true, overclock: 15, fragment: 'legendary' },
    story: '所有声音汇聚成了一个音符——那个音符就是你。是你的恐惧、你的勇气、你的记忆、你的选择。全部在一起。这就是"你"。',
  },
];
