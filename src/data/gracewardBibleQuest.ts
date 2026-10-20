export interface BibleQuestion {
  prompt: string;
  choices: readonly string[];
  answer: number;
  reference: string;
  explanation: string;
}
export interface BibleTrail { id: number; title: string; subtitle: string; questions: BibleQuestion[] }

// Original summaries, not quotations from a copyrighted translation.
// Keep v1 content stable: the completion RPC validates the same answer ordering.
export const BIBLE_TRAILS: BibleTrail[] = [
  { id: 1, title: "A beautiful beginning", subtitle: "Creation Garden", questions: [
    { prompt: "In Genesis, what does God create on the first day?", choices: ["The sun", "Light", "Birds", "People"], answer: 1, reference: "Genesis 1:3–5", explanation: "God calls light into being and separates light from darkness." },
    { prompt: "Which garden is the home of Adam and Eve?", choices: ["Eden", "Gethsemane", "Jericho", "Bethany"], answer: 0, reference: "Genesis 2:8", explanation: "God plants a garden in Eden and places the first human there." },
    { prompt: "What does God ask Noah to build?", choices: ["A tower", "A palace", "An ark", "A temple"], answer: 2, reference: "Genesis 6:14", explanation: "Noah builds an ark as God directs him." },
    { prompt: "What sign accompanies God's covenant after the flood?", choices: ["A star", "A rainbow", "A crown", "A mountain"], answer: 1, reference: "Genesis 9:12–17", explanation: "The rainbow is the sign of God's covenant with living creatures." },
    { prompt: "On which day does God rest from the work of creation?", choices: ["The first", "The third", "The sixth", "The seventh"], answer: 3, reference: "Genesis 2:2–3", explanation: "God rests on the seventh day and blesses it." },
  ] },
  { id: 2, title: "Courage on the journey", subtitle: "Promise Valley", questions: [
    { prompt: "Who leads the Israelites out of Egypt?", choices: ["Moses", "David", "Jonah", "Solomon"], answer: 0, reference: "Exodus 12:31–42", explanation: "Moses leads the people out of Egypt after Pharaoh tells them to leave." },
    { prompt: "What food appears for the Israelites in the wilderness?", choices: ["Grapes", "Olives", "Manna", "Figs"], answer: 2, reference: "Exodus 16:14–15, 31", explanation: "The people call this food manna. It is God's provision for their journey." },
    { prompt: "Who faces Goliath with a sling?", choices: ["Saul", "David", "Samuel", "Elijah"], answer: 1, reference: "1 Samuel 17:40–50", explanation: "David faces Goliath with trust in God, a sling and stones." },
    { prompt: "Who continues praying even when a royal decree forbids it?", choices: ["Pharaoh", "Herod", "Pilate", "Daniel"], answer: 3, reference: "Daniel 6:10", explanation: "Daniel continues his regular prayer after learning about the decree." },
    { prompt: "Which woman tells Naomi that she will stay with her?", choices: ["Ruth", "Esther", "Miriam", "Deborah"], answer: 0, reference: "Ruth 1:16–17", explanation: "Ruth chooses to remain with Naomi, showing loyalty and love." },
  ] },
  { id: 3, title: "Love in action", subtitle: "Parable Village", questions: [
    { prompt: "In Jesus' parable, who stops to help the injured traveler?", choices: ["The priest", "The Samaritan", "The innkeeper's son", "The Levite"], answer: 1, reference: "Luke 10:30–35", explanation: "The Samaritan cares for the traveler and arranges for his continued care." },
    { prompt: "In the lost sheep parable, how many sheep does the shepherd search for?", choices: ["Ten", "Fifty", "One", "Twelve"], answer: 2, reference: "Luke 15:3–7", explanation: "The shepherd searches for the one lost sheep and rejoices when it is found." },
    { prompt: "How does the father welcome his returning son in Luke 15?", choices: ["He sends him away", "He ignores him", "He locks the door", "He runs to embrace him"], answer: 3, reference: "Luke 15:20", explanation: "The father sees his son, feels compassion and runs to welcome him." },
    { prompt: "What does Jesus do for his disciples in John 13?", choices: ["Washes their feet", "Builds them houses", "Makes them crowns", "Buys them boats"], answer: 0, reference: "John 13:4–15", explanation: "Jesus washes their feet and gives them an example of serving one another." },
    { prompt: "In the parable of the builders, where does the wise person build?", choices: ["On sand", "On rock", "In a tree", "On a boat"], answer: 1, reference: "Matthew 7:24–27", explanation: "Jesus compares hearing and practicing his words to building on rock." },
  ] },
];

export const scoreBibleTrail = (trail: BibleTrail, answers: readonly number[]) =>
  trail.questions.reduce((score, question, index) => score + Number(answers[index] === question.answer), 0);

export interface QuestDraft { version: 1; nodeId: number; answers: number[]; revealed: boolean }
export const parseQuestDraft = (raw: string | null, nodeId: number): QuestDraft => {
  const empty: QuestDraft = { version: 1, nodeId, answers: [], revealed: false };
  try {
    const value = JSON.parse(raw ?? "null");
    const trail = BIBLE_TRAILS.find((item) => item.id === nodeId);
    if (!trail || value?.version !== 1 || value.nodeId !== nodeId || !Array.isArray(value.answers)
      || value.answers.length > trail.questions.length || typeof value.revealed !== "boolean"
      || value.answers.some((answer: unknown) => !Number.isInteger(answer) || Number(answer) < 0 || Number(answer) > 3)
      || (value.revealed && value.answers.length === 0)) return empty;
    return value;
  } catch { return empty; }
};
