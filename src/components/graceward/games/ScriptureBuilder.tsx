import { useRef, useState } from "react";
import { BookOpen, Lightbulb, Sparkles, ArrowRight } from "lucide-react";
import { GRACEWARD_GAME_VERSES } from "@/data/gracewardGameVerses";
import { createRoundId, versePoints, type GameScore } from "@/lib/gracewardGameScores";
import { GameFinale, GameFrame, GameHUD, GameIntro, type GamePhase } from "./GamePresentation";
import { shuffleGracewardCards } from "./NoahsPairs";
import { useGameClock, useGameRecords, useGameSound } from "./useGameSession";

export function GracewardVerseBuilder({playerId}:{playerId?:string}) {
  const [phase,setPhase]=useState<GamePhase>("intro");
  const [mode,setMode]=useState<"guided"|"challenge">("guided");
  const [paused,setPaused]=useState(false);
  const [passages,setPassages]=useState(()=>shuffleGracewardCards(GRACEWARD_GAME_VERSES).slice(0,3));
  const [round,setRound]=useState(0);
  const [order,setOrder]=useState<number[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [mistakes,setMistakes]=useState(0);
  const [hints,setHints]=useState(0);
  const [totalMistakes,setTotalMistakes]=useState(0);
  const [totalHints,setTotalHints]=useState(0);
  const [score,setScore]=useState(0);
  const [verseComplete,setVerseComplete]=useState(false);
  const [feedback,setFeedback]=useState("Find the first word to begin.");
  const [wrong,setWrong]=useState<number|null>(null);
  const [result,setResult]=useState<GameScore|null>(null);
  const roundId=useRef(createRoundId());
  const selecting=useRef(false);
  const records=useGameRecords(playerId);
  const best=records.bests[`scripture-builder:${mode}`]?.score;
  const {sound,toggleSound,cue}=useGameSound();
  const {seconds,resetClock}=useGameClock(phase==="playing",paused,()=>setPaused(true));
  const verse=passages[round];
  const words=verse.text.split(/\s+/);
  const earned=Math.max(100,versePoints(mistakes,hints)-(mode==="guided"?200:0));
  function prepare(text:string) {setOrder(shuffleGracewardCards(text.split(/\s+/).map((_,index)=>index)));setSelected([]);setMistakes(0);setHints(0);setWrong(null);setVerseComplete(false);setFeedback("Find the first word to begin.");selecting.current=false;}
  function start() {
    const next=shuffleGracewardCards(GRACEWARD_GAME_VERSES).slice(0,3);
    setPassages(next);setRound(0);prepare(next[0].text);setScore(0);setTotalMistakes(0);setTotalHints(0);setResult(null);setPaused(false);resetClock();roundId.current=createRoundId();setPhase("playing");cue("tap");
  }
  function choose(index:number,withHint=false) {
    if (paused||verseComplete||selecting.current||selected.includes(index)||phase!=="playing") return;
    selecting.current=true;
    if(words[index]!==words[selected.length]) {
      setMistakes(n=>n+1);setTotalMistakes(n=>n+1);setWrong(index);setFeedback("Not quite. Look for the word that comes next.");cue("miss");selecting.current=false;return;
    }
    const next=[...selected,index];setSelected(next);setWrong(null);
    if(withHint){setHints(n=>n+1);setTotalHints(n=>n+1);}
    setFeedback(withHint?"A little help along the way. Next word placed.":`${next.length} of ${words.length} words restored.`);cue("match");
    if(next.length===words.length){
      const points=Math.max(100,versePoints(mistakes,hints+Number(withHint))-(mode==="guided"?200:0));
      setScore(n=>n+points);setVerseComplete(true);setFeedback(`Passage restored! +${points} points.`);cue("finish");
    }
    selecting.current=false;
  }
  function advance() {
    if(round===2){
      setResult({id:roundId.current,game:"scripture-builder",mode,score,stars:totalMistakes+totalHints===0?3:totalMistakes+totalHints<=5?2:1,seconds,completedAt:new Date().toISOString()});setPhase("finished");cue("finish");
    } else {const next=round+1;setRound(next);prepare(passages[next].text);}
  }
  return <GameFrame title="Scripture Builder" theme="words" phase={phase} paused={paused} onPause={()=>setPaused(true)} onResume={()=>setPaused(false)} onRestart={start} sound={sound} toggleSound={toggleSound}>
    {phase==="intro"?<GameIntro theme="words" eyebrow="WORDS THAT LIGHT THE WAY" title="Scripture Builder" description="Restore three passages, one word at a time. Find your rhythm and watch the story come together." best={best} onStart={start} startLabel="Open the story">
      <div className="gg-mode-picker" role="group" aria-label="Choose a mode"><button aria-pressed={mode==="guided"} onClick={()=>setMode("guided")}><BookOpen/><strong>Guided</strong><span>Keep the passage in view</span></button><button aria-pressed={mode==="challenge"} onClick={()=>setMode("challenge")}><Sparkles/><strong>Challenge</strong><span>Build it from memory</span></button></div>
      <p className="gg-rules">Three passages per round. Earn up to {mode==="guided"?300:500} points each. A wrong word costs 40 points; a hint costs 100. Every completed passage earns at least 100.</p>
    </GameIntro>:phase==="finished"&&result?<GameFinale result={result} playerId={playerId} title="A little light to carry." description="Three passages restored. Take one of these words with you into the rest of your day." theme="words" onReplay={()=>setPhase("intro")}><div className="gg-verse-keepsake"><BookOpen/><p>{passages[2].text}</p><small>{passages[2].reference} · WEB Classic</small></div></GameFinale>:<>
      <GameHUD score={score} best={best} seconds={seconds} progress={`${round+1}/3`}/>
      <div className="gg-lantern-path" aria-label={`Passage ${round+1} of 3`}>{[0,1,2].map(n=><span key={n} className={n<round||(n===round&&verseComplete)?"is-lit":n===round?"is-current":""}><BookOpen size={18}/></span>)}</div>
      <section className={`gg-word-panel ${verseComplete?"is-complete":""}`} aria-hidden={paused||undefined} inert={paused||undefined}>
        <p className="gg-overline">PASSAGE {round+1} OF 3</p><h1>{verse.reference}</h1><p className="gg-verse-context">{verse.context}</p>
        {mode==="guided"&&!verseComplete&&<blockquote className="gg-reading-guide" aria-label="Passage guide">{verse.text}</blockquote>}
        <div className="gg-word-slots" aria-label="Your passage">{words.map((_,n)=><span key={n} className={n<selected.length?"is-filled":n===selected.length?"is-next":""}>{n<selected.length?words[selected[n]]:<span aria-hidden="true">{n+1}</span>}</span>)}</div>
        {!verseComplete?<><div className="gg-word-bank" aria-label="Available words">{order.map(index=><button className={`gg-word-tile ${wrong===index?"is-wrong":""}`} key={index} disabled={selected.includes(index)} onClick={()=>choose(index)}>{words[index]}</button>)}</div>
          <div className="gg-word-tools"><button className="gg-hint" onClick={()=>{const next=order.find(index=>!selected.includes(index)&&words[index]===words[selected.length]);if(next!==undefined)choose(next,true);}}><Lightbulb size={17}/> Place next word <small>−100</small></button><span>{earned} points available</span></div></>:<div className="gg-verse-reveal"><span className="gg-tag"><Sparkles size={14}/> Passage restored</span><p>{verse.reflection}</p><p className="gg-prayer">{verse.prayer}</p><button className="gg-cta" onClick={advance}>{round===2?"See my finale":"Next passage"}<ArrowRight size={18}/></button></div>}
        <p className="gg-feedback" role="status" aria-live="polite">{feedback}</p>
        <a className="gg-scripture-source" href={verse.sourceUrl} target="_blank" rel="noopener noreferrer">Read the chapter · WEB Classic</a>
      </section><p className="gg-fineprint">World English Bible Classic · Public domain</p>
    </>}
  </GameFrame>;
}
