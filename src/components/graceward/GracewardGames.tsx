import { useState } from "react";
import { Undo2, RotateCcw, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRACEWARD_GAME_VERSES } from "@/data/gracewardGameVerses";

export function shuffleGracewardCards<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const animals = [
  { name: "Sheep", symbol: "🐑" }, { name: "Dove", symbol: "🕊️" },
  { name: "Lion", symbol: "🦁" }, { name: "Elephant", symbol: "🐘" },
  { name: "Rabbit", symbol: "🐇" }, { name: "Giraffe", symbol: "🦒" },
];
const makeDeck = () => shuffleGracewardCards(animals.flatMap(animal => [0, 1].map(copy => ({ ...animal, id: `${animal.name}-${copy}` }))));
export function GracewardPairs() {
  const [deck, setDeck] = useState(makeDeck);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [turns, setTurns] = useState(0);
  const complete = matched.length === animals.length;
  function reveal(id: string) {
    const card = deck.find(item => item.id === id)!;
    if (open.length === 2 || open.includes(id) || matched.includes(card.name)) return;
    const next = [...open, id];
    setOpen(next);
    if (next.length === 2) {
      setTurns(value => value + 1);
      if (deck.find(item => item.id === next[0])!.name === card.name) {
        setMatched(value => [...value, card.name]);
        setOpen([]);
      }
    }
  }
  function restart() { setDeck(makeDeck()); setOpen([]); setMatched([]); setTurns(0); }
  return <section aria-label="Noah’s Pairs" className="space-y-4">
    <h3 className="font-serif text-2xl">Noah’s Pairs</h3>
    <p className="text-sm leading-6 text-muted-foreground">Find the six animal pairs. An unhurried memory game inspired by Noah’s ark.</p>
    <p role="status" className="text-sm">{matched.length} / 6 pairs · {turns} turns</p>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{deck.map((card, index) => {
      const isMatched = matched.includes(card.name);
      const revealed = open.includes(card.id) || isMatched;
      return <button key={card.id} disabled={isMatched || open.length === 2 || open.includes(card.id)} aria-label={revealed ? `${card.name}${isMatched ? ", matched" : ""}` : `Reveal card ${index + 1}`} onClick={() => reveal(card.id)} className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border p-2 focus-visible:ring-2 focus-visible:ring-primary ${isMatched ? "border-primary/30 bg-primary/10" : "border-primary/15 bg-background"}`}>
        {revealed ? <><span aria-hidden="true" className="text-3xl">{card.symbol}</span><span className="mt-1 text-[10px]">{card.name}{isMatched ? " ✓" : ""}</span></> : <PawPrint aria-hidden="true" className="h-7 w-7 text-primary/50" />}
      </button>;
    })}</div>
    {open.length === 2 && <div><p className="text-sm" role="status">Two different animals. Take a look, then try another pair.</p><Button className="mt-2 min-h-11" onClick={() => setOpen([])}>Turn cards over</Button></div>}
    {complete && <div role="status" className="rounded-2xl bg-primary/5 p-4"><h4 className="font-medium">Every pair has a place.</h4><p className="mt-2 text-sm leading-6">Take a moment to thank God for one creature or place you love. Read the ark story in Genesis 6–9 when you’d like to explore further.</p></div>}
    <Button variant="outline" className="min-h-11" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{complete ? "Play again" : "Start over"}</Button>
  </section>;
}
// Existing editorial collection: verified WEB Classic excerpts with context and
// chapter links. Token indices keep repeated words independently selectable.
const verses = GRACEWARD_GAME_VERSES;
export function GracewardVerseBuilder() {
  const [round, setRound] = useState(() => Math.floor(Math.random() * verses.length));
  const verse = verses[round % verses.length];
  const words = verse.text.split(/\s+/);
  const [order, setOrder] = useState(() => shuffleGracewardCards(words.map((_, index) => index)));
  const [selected, setSelected] = useState<number[]>([]);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState(false);
  function nextVerse() {
    const next = round + 1;
    setRound(next);
    setOrder(shuffleGracewardCards(verses[next % verses.length].text.split(/\s+/).map((_, index) => index)));
    setSelected([]); setHint(false); setFeedback(""); setComplete(false);
  }
  function check() {
    if (selected.map(index => words[index]).join(" ") === verse.text) {
      setComplete(true); setFeedback("You’ve brought the passage together.");
    } else setFeedback("A few words need another place. Try undoing a word, or reveal the passage for help.");
  }
  return <section aria-label="Scripture Builder" className="space-y-4">
    <h3 className="font-serif text-2xl">Scripture Builder</h3><p className="text-sm leading-6 text-muted-foreground">Tap the words in order. Take your time; help is always available.</p>
    <p className="text-sm font-medium text-primary">{verse.reference}</p>
    <p className="text-sm leading-6 text-muted-foreground">{verse.context}</p>
    <div className="min-h-24 rounded-2xl border border-primary/20 bg-primary/5 p-4 font-serif text-xl leading-8" aria-label="Your passage" aria-live="polite">{selected.length ? selected.map(index => words[index]).join(" ") : "Your passage will take shape here…"}</div>
    {!complete && <><div className="flex flex-wrap gap-2" aria-label="Available words">{order.map(index => <Button key={index} variant="outline" disabled={selected.includes(index)} onClick={() => { setSelected(value => [...value, index]); setFeedback(""); }} className="min-h-11">{words[index]}</Button>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!selected.length} className="min-h-11" onClick={() => { setSelected(value => value.slice(0, -1)); setFeedback(""); }}><Undo2 className="mr-2 h-4 w-4" />Undo</Button><Button variant="ghost" className="min-h-11" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? "Hide passage" : "Reveal passage"}</Button><Button className="min-h-11" disabled={selected.length !== words.length} onClick={check}>Check passage</Button></div>
    </>}
    {hint && !complete && <blockquote className="rounded-2xl border p-4 font-serif text-lg">{verse.text}</blockquote>}
    {feedback && <p role="status" className="text-sm leading-6">{feedback}</p>}
    {complete && <div className="rounded-2xl bg-primary/5 p-4"><p className="text-sm leading-6">{verse.reflection}</p><p className="mt-3 text-sm italic leading-6">{verse.prayer}</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-2"><a href={verse.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs text-primary underline">Read the chapter · WEB Classic</a><Button variant="outline" className="min-h-11" onClick={nextVerse}>{complete ? "Another passage" : "Try another passage"}</Button></div>
    <p className="text-[10px] text-muted-foreground">World English Bible Classic · Public domain</p>
  </section>;
}
