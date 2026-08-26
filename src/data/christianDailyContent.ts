export interface ChristianDailyContent {
  reference: string;
  text: string;
  translation: "WEB";
  translationLabel: string;
  sourceUrl: string;
  theme: string;
  reflection: string;
  prayer: string;
  practice: string;
}

// Curated, deterministic excerpts from the public-domain World English Bible.
// Scripture shown in product UI must come from reviewed records like these,
// never from generative model memory.
export const CHRISTIAN_DAILY_CONTENT: readonly ChristianDailyContent[] = [
  {
    reference: "Psalm 118:24",
    text: "This is the day that Yahweh has made. We will rejoice and be glad in it!",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/PSA118.htm",
    theme: "Receive the day",
    reflection: "Before you try to control the day, receive it as a gift. What would gratitude change about your first next step?",
    prayer: "God, thank you for the life in front of me today. Give me attention for what matters, courage for what is mine to do, and grace for what I cannot finish. Amen.",
    practice: "Name one gift in this day before opening your task list.",
  },
  {
    reference: "Micah 6:8",
    text: "He has shown you, O man, what is good. What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/MIC06.htm",
    theme: "Walk humbly",
    reflection: "Faithfulness is often ordinary: one just choice, one merciful response, one humble step.",
    prayer: "God, teach me to choose justice without pride, mercy without avoidance, and humility without fear. Guide my actions today. Amen.",
    practice: "Choose one action today that makes room for mercy.",
  },
  {
    reference: "Matthew 11:28",
    text: "Come to me, all you who labor and are heavily burdened, and I will give you rest.",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/MAT11.htm",
    theme: "Make room for rest",
    reflection: "Rest is not a reward for becoming limitless. Bring the weight you are carrying to Christ before deciding what the day requires.",
    prayer: "Jesus, I bring you the pressure I am carrying. Help me work with love, receive my limits, and make room for the rest you give. Amen.",
    practice: "Remove or shorten one nonessential demand from today.",
  },
  {
    reference: "Colossians 3:17",
    text: "Whatever you do, in word or in deed, do all in the name of the Lord Jesus, giving thanks to God the Father through him.",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/COL03.htm",
    theme: "Practice presence",
    reflection: "Even ordinary work can become an offering when it is done with attention, integrity, and gratitude.",
    prayer: "God, meet me in the ordinary work of this day. Let my words and actions reflect the love of Christ. Amen.",
    practice: "Begin your next ordinary task with a ten-second prayer.",
  },
  {
    reference: "Philippians 4:6–7",
    text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/PHP04.htm",
    theme: "Bring what is real",
    reflection: "Prayer does not require pretending that anxiety is absent. It gives you a place to bring what is actually here.",
    prayer: "God, here is what I am carrying today. Guard my heart and mind, and help me take the next faithful step without needing to see the whole path. Amen.",
    practice: "Write one worry and one specific request beside it.",
  },
  {
    reference: "James 1:19",
    text: "So, then, my beloved brothers, let every man be swift to hear, slow to speak, and slow to anger.",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/JAS01.htm",
    theme: "Listen first",
    reflection: "Attention can be an act of love. Where might listening be more faithful than preparing your answer?",
    prayer: "God, quiet the need to defend or perform. Help me listen with patience and speak with care. Amen.",
    practice: "Give one person your full attention without interrupting.",
  },
  {
    reference: "Galatians 6:9",
    text: "Let’s not be weary in doing good, for we will reap in due season if we don’t give up.",
    translation: "WEB",
    translationLabel: "World English Bible Classic · Public Domain",
    sourceUrl: "https://ebible.org/eng-web/GAL06.htm",
    theme: "Keep going",
    reflection: "Perseverance is not frantic intensity. It is the grace to return to good work in a sustainable way.",
    prayer: "God, renew me where I am tired. Give me patience for slow growth and faithfulness in the next small act of good. Amen.",
    practice: "Choose the smallest useful version of something worth continuing.",
  },
] as const;

export const getChristianDailyContent = (date = new Date()): ChristianDailyContent => {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0))
      / 86_400_000,
  );
  return CHRISTIAN_DAILY_CONTENT[Math.abs(dayOfYear) % CHRISTIAN_DAILY_CONTENT.length];
};
