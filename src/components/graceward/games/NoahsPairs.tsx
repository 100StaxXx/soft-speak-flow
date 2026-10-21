import { useEffect, useRef, useState } from "react";
import { Anchor, Check, PawPrint } from "lucide-react";
import { createRoundId, pairPoints, pairsTimeBonus, type GameScore } from "@/lib/gracewardGameScores";
import { GameFinale, GameFrame, GameHUD, GameIntro, type GamePhase } from "./GamePresentation";
import { useGameClock, useGameRecords, useGameSound } from "./useGameSession";

export function shuffleGracewardCards<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const ANIMALS = [
  {name:"Sheep",symbol:"🐑"}, {name:"Dove",symbol:"🕊️"}, {name:"Lion",symbol:"🦁"}, {name:"Elephant",symbol:"🐘"},
  {name:"Rabbit",symbol:"🐇"}, {name:"Giraffe",symbol:"🦒"}, {name:"Bear",symbol:"🐻"}, {name:"Fox",symbol:"🦊"},
];
const makeDeck = (count:number) => shuffleGracewardCards(ANIMALS.slice(0,count).flatMap(animal=>[0,1].map(copy=>({...animal,id:`${animal.name}-${copy}`}))));

export function GracewardPairs({playerId}:{playerId?:string}) {
  const [phase,setPhase] = useState<GamePhase>("intro");
  const [mode,setMode] = useState<"meadow"|"voyage">("meadow");
  const [paused,setPaused] = useState(false);
  const [deck,setDeck] = useState(()=>makeDeck(6));
  const [open,setOpen] = useState<string[]>([]);
  const [matched,setMatched] = useState<string[]>([]);
  const [turns,setTurns] = useState(0);
  const [streak,setStreak] = useState(0);
  const [points,setPoints] = useState(0);
  const [message,setMessage] = useState("Find a pair to welcome them aboard.");
  const [result,setResult] = useState<GameScore|null>(null);
  const locked = useRef(false);
  const firstCard = useRef<string|null>(null);
  const roundId = useRef(createRoundId());
  const count = mode === "meadow" ? 6 : 8;
  const records=useGameRecords(playerId);
  const best=records.bests[`noahs-pairs:${mode}`]?.score;
  const {sound,toggleSound,cue}=useGameSound();
  const {seconds,resetClock}=useGameClock(phase==="playing",paused,()=>setPaused(true));
  useEffect(()=>{
    if (open.length!==2 || paused || phase!=="playing") return;
    const timer=window.setTimeout(()=>{setOpen([]);firstCard.current=null;locked.current=false;},950);
    return ()=>window.clearTimeout(timer);
  },[open,paused,phase]);
  function start() {
    setDeck(makeDeck(count));setOpen([]);setMatched([]);setTurns(0);setStreak(0);setPoints(0);setResult(null);setPaused(false);resetClock();
    firstCard.current=null;locked.current=false;roundId.current=createRoundId();setMessage("Find a pair to welcome them aboard.");setPhase("playing");cue("tap");
  }
  function reveal(id:string) {
    if (locked.current || paused || phase!=="playing") return;
    const card=deck.find(item=>item.id===id)!;
    if (firstCard.current===id || matched.includes(card.name)) return;
    if (!firstCard.current) {firstCard.current=id;setOpen([id]);cue("tap");return;}
    locked.current=true;
    const first=deck.find(item=>item.id===firstCard.current)!;
    const nextTurns=turns+1;
    setTurns(nextTurns);setOpen([first.id,id]);
    if (first.name===card.name) {
      const nextMatched=[...matched,card.name];const nextStreak=streak+1;const earned=pairPoints(nextStreak);const nextPoints=points+earned;
      setMatched(nextMatched);setStreak(nextStreak);setPoints(nextPoints);setMessage(`${card.name} pair aboard! +${earned}${nextStreak>1?` · ${nextStreak} pair streak`:""}`);
      firstCard.current=null;setOpen([]);locked.current=false;cue("match");
      if (nextMatched.length===count) {
        setResult({id:roundId.current,game:"noahs-pairs",mode,score:nextPoints+pairsTimeBonus(seconds,count),stars:nextTurns<=count+2?3:nextTurns<=count*2?2:1,seconds,completedAt:new Date().toISOString()});
        setPhase("finished");cue("finish");
      }
    } else {setStreak(0);setMessage("Not a pair. Remember their places…");cue("miss");}
  }
  return <GameFrame title="Noah’s Pairs" theme="ark" phase={phase} paused={paused} onPause={()=>setPaused(true)} onResume={()=>setPaused(false)} onRestart={start} sound={sound} toggleSound={toggleSound}>
    {phase==="intro" ? <GameIntro theme="ark" eyebrow="THE ARK IS WAITING" title="Noah’s Pairs" description="A memory voyage, two by two. Find matching animals, build a streak, and bring everyone aboard." best={best} onStart={start} startLabel="Set sail">
      <div className="gg-mode-picker" role="group" aria-label="Choose difficulty"><button aria-pressed={mode==="meadow"} onClick={()=>setMode("meadow")}><PawPrint/><strong>Meadow</strong><span>6 pairs · a gentle start</span></button><button aria-pressed={mode==="voyage"} onClick={()=>setMode("voyage")}><Anchor/><strong>Voyage</strong><span>8 pairs · a bigger challenge</span></button></div>
      <p className="gg-rules">Match a pair for 200 points. Consecutive pairs build a bonus; faster finishes earn extra points. There’s no time limit.</p>
    </GameIntro> : phase==="finished" && result ? <GameFinale result={result} playerId={playerId} title="Everyone’s aboard." description={`You brought ${count} pairs together in ${turns} turns. The ark is ready for its next adventure.`} theme="ark" onReplay={()=>setPhase("intro")}><p className="gg-bonus">+{pairsTimeBonus(seconds,count)} time bonus · {turns} turns</p></GameFinale> : <>
      <GameHUD score={points} best={best} seconds={seconds} progress={`${matched.length}/${count}`} streak={streak}/>
      <div className="gg-board-heading"><div><p className="gg-overline">TWO BY TWO</p><h1>Bring them aboard.</h1></div><span className="gg-turns">{turns} turns</span></div>
      <div className="gg-pairs-board" aria-label="Animal cards" aria-hidden={paused || undefined} inert={paused || undefined}>{deck.map((card,index)=>{
        const isMatched=matched.includes(card.name);const revealed=open.includes(card.id)||isMatched;
        return <button key={card.id} className={`gg-pair-card ${revealed?"is-revealed":""} ${isMatched?"is-matched":""}`} disabled={isMatched||open.length===2||open.includes(card.id)} aria-label={revealed?`${card.name}${isMatched?", matched":""}`:`Reveal card ${index+1}`} onClick={()=>reveal(card.id)}>
          <span className="gg-card-inner"><span className="gg-card-back" aria-hidden="true"><PawPrint/><i/></span><span className="gg-card-front" aria-hidden="true"><span>{card.symbol}</span><small>{card.name}</small>{isMatched&&<Check size={14}/>}</span></span>
        </button>;
      })}</div>
      <p className="gg-feedback" role="status" aria-live="polite">{message}</p>
      <div className="gg-boarding-line" aria-label={`${matched.length} of ${count} pairs aboard`}>{ANIMALS.slice(0,count).map(animal=><span key={animal.name} className={matched.includes(animal.name)?"aboard":""} aria-hidden="true">{animal.symbol}</span>)}</div>
      <p className="gg-fineprint">Keep a streak going to beat your personal best.</p>
    </>}
  </GameFrame>;
}
