export type ScenarioTurn = {
  /** Who speaks this turn. The user always has at least one turn. */
  speaker: "npc" | "you";
  /** Chinese line — what the user should say (or hear the NPC say via TTS). */
  hanzi: string;
  pinyin: string;
  english: string;
};

export type Scenario = {
  id: string;
  title: string;
  emoji: string;
  hskLevel: number;
  minutes: number;
  blurb: string;
  setting: string;
  turns: ScenarioTurn[];
};

/**
 * Hand-curated starter set. Expands per phase / per AI batch later.
 * Only the "you" turns produce a Whisper scoring pass; "npc" turns are
 * played back via TTS so the user hears the dialogue flow.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "greetings",
    title: "Greetings",
    emoji: "👋",
    hskLevel: 1,
    minutes: 2,
    blurb: "Say hello and introduce yourself.",
    setting: "You bump into a new classmate on the first day.",
    turns: [
      { speaker: "npc", hanzi: "你好！", pinyin: "nǐ hǎo!", english: "Hello!" },
      { speaker: "you", hanzi: "你好！", pinyin: "nǐ hǎo!", english: "Hello!" },
      { speaker: "npc", hanzi: "你叫什么名字？", pinyin: "nǐ jiào shénme míngzi?", english: "What's your name?" },
      { speaker: "you", hanzi: "我叫李明。", pinyin: "wǒ jiào lǐ míng.", english: "My name is Li Ming." },
      { speaker: "npc", hanzi: "很高兴认识你！", pinyin: "hěn gāoxìng rènshi nǐ!", english: "Nice to meet you!" },
      { speaker: "you", hanzi: "我也是。", pinyin: "wǒ yě shì.", english: "Me too." },
    ],
  },
  {
    id: "coffee",
    title: "Order coffee",
    emoji: "☕",
    hskLevel: 1,
    minutes: 2,
    blurb: "Buy a coffee at a café.",
    setting: "You walk into a busy Shanghai coffee shop.",
    turns: [
      { speaker: "npc", hanzi: "欢迎光临，您要什么？", pinyin: "huānyíng guānglín, nín yào shénme?", english: "Welcome, what would you like?" },
      { speaker: "you", hanzi: "我要一杯咖啡。", pinyin: "wǒ yào yì bēi kāfēi.", english: "I'd like one coffee." },
      { speaker: "npc", hanzi: "大杯还是小杯？", pinyin: "dà bēi háishì xiǎo bēi?", english: "Large or small?" },
      { speaker: "you", hanzi: "大杯，谢谢。", pinyin: "dà bēi, xièxie.", english: "Large, thanks." },
      { speaker: "npc", hanzi: "一共三十块。", pinyin: "yīgòng sānshí kuài.", english: "That's thirty yuan total." },
      { speaker: "you", hanzi: "好的。", pinyin: "hǎo de.", english: "Okay." },
    ],
  },
  {
    id: "directions",
    title: "Ask directions",
    emoji: "🧭",
    hskLevel: 2,
    minutes: 3,
    blurb: "Find the metro station.",
    setting: "You're lost in Beijing and need the nearest subway.",
    turns: [
      { speaker: "you", hanzi: "请问，地铁站在哪里？", pinyin: "qǐngwèn, dìtiě zhàn zài nǎli?", english: "Excuse me, where is the metro station?" },
      { speaker: "npc", hanzi: "一直往前走。", pinyin: "yìzhí wǎng qián zǒu.", english: "Go straight ahead." },
      { speaker: "you", hanzi: "远吗？", pinyin: "yuǎn ma?", english: "Is it far?" },
      { speaker: "npc", hanzi: "不远，大概五分钟。", pinyin: "bù yuǎn, dàgài wǔ fēnzhōng.", english: "Not far, about five minutes." },
      { speaker: "you", hanzi: "谢谢你。", pinyin: "xièxie nǐ.", english: "Thank you." },
    ],
  },
  {
    id: "restaurant",
    title: "At the restaurant",
    emoji: "🥟",
    hskLevel: 2,
    minutes: 3,
    blurb: "Order dumplings and water.",
    setting: "You sit down at a small noodle shop.",
    turns: [
      { speaker: "npc", hanzi: "几位？", pinyin: "jǐ wèi?", english: "How many people?" },
      { speaker: "you", hanzi: "两位。", pinyin: "liǎng wèi.", english: "Two people." },
      { speaker: "npc", hanzi: "您要什么？", pinyin: "nín yào shénme?", english: "What would you like?" },
      { speaker: "you", hanzi: "一份饺子，两杯水。", pinyin: "yī fèn jiǎozi, liǎng bēi shuǐ.", english: "One order of dumplings, two waters." },
      { speaker: "npc", hanzi: "好的，请等一下。", pinyin: "hǎo de, qǐng děng yíxià.", english: "Okay, please wait a moment." },
      { speaker: "you", hanzi: "谢谢。", pinyin: "xièxie.", english: "Thanks." },
    ],
  },
  {
    id: "taxi",
    title: "Take a taxi",
    emoji: "🚕",
    hskLevel: 2,
    minutes: 2,
    blurb: "Tell the driver where to go.",
    setting: "You flag down a cab outside the airport.",
    turns: [
      { speaker: "npc", hanzi: "您去哪儿？", pinyin: "nín qù nǎr?", english: "Where are you going?" },
      { speaker: "you", hanzi: "我去机场。", pinyin: "wǒ qù jīchǎng.", english: "I'm going to the airport." },
      { speaker: "npc", hanzi: "好的，您赶时间吗？", pinyin: "hǎo de, nín gǎn shíjiān ma?", english: "Okay. Are you in a hurry?" },
      { speaker: "you", hanzi: "有一点。", pinyin: "yǒu yì diǎn.", english: "A little." },
      { speaker: "npc", hanzi: "没问题，二十分钟就到。", pinyin: "méi wèntí, èrshí fēnzhōng jiù dào.", english: "No problem, we'll be there in twenty minutes." },
      { speaker: "you", hanzi: "谢谢！", pinyin: "xièxie!", english: "Thanks!" },
    ],
  },
  {
    id: "shopping",
    title: "Shopping for clothes",
    emoji: "🛍️",
    hskLevel: 3,
    minutes: 4,
    blurb: "Try on clothes and ask about price.",
    setting: "You're browsing in a clothing store downtown.",
    turns: [
      { speaker: "npc", hanzi: "需要帮忙吗？", pinyin: "xūyào bāngmáng ma?", english: "Need any help?" },
      { speaker: "you", hanzi: "我想看看这件衣服。", pinyin: "wǒ xiǎng kànkan zhè jiàn yīfu.", english: "I'd like to take a look at this piece of clothing." },
      { speaker: "npc", hanzi: "您穿什么号？", pinyin: "nín chuān shénme hào?", english: "What size do you wear?" },
      { speaker: "you", hanzi: "中号，谢谢。", pinyin: "zhōng hào, xièxie.", english: "Medium, thanks." },
      { speaker: "npc", hanzi: "试衣间在那边。", pinyin: "shì yī jiān zài nà biān.", english: "The fitting room is over there." },
      { speaker: "you", hanzi: "这件多少钱？", pinyin: "zhè jiàn duōshǎo qián?", english: "How much is this?" },
      { speaker: "npc", hanzi: "两百块。", pinyin: "liǎng bǎi kuài.", english: "Two hundred yuan." },
      { speaker: "you", hanzi: "可以便宜一点吗？", pinyin: "kěyǐ piányi yìdiǎn ma?", english: "Can it be a little cheaper?" },
    ],
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
