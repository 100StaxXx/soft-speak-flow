import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Coins, Sparkles, Star } from "lucide-react";
import { BIBLE_TRAILS, parseQuestDraft, scoreBibleTrail } from "@/data/gracewardBibleQuest";
import { useGracewardAdventure, type AdventureReceipt } from "@/hooks/useGracewardAdventure";
import { useCompanion } from "@/hooks/useCompanion";
import { safeLocalStorage } from "@/utils/storage";
import { AdventureCompanion } from "@/components/graceward/AdventureCompanion";
import { createRoundId, questPoints, type GameScore } from "@/lib/gracewardGameScores";
import { GameFinale, GameFrame, GameHUD, GameIntro } from "@/components/graceward/games/GamePresentation";
import { useGameClock, useGameRecords, useGameSound } from "@/components/graceward/games/useGameSession";
import "@/styles/gracewardAdventure.css";

interface QuestRun { id: string; seconds: number; finishedAt?: string }
function readRun(key:string):QuestRun {
  try {
    const value=JSON.parse(safeLocalStorage.getItem(key)||"null");
    if(typeof value?.id==="string" && value.id.length<150 && Number.isFinite(value.seconds) && value.seconds>=0 && value.seconds<=86400) return {id:value.id,seconds:value.seconds,finishedAt:typeof value.finishedAt==="string"&&Number.isFinite(Date.parse(value.finishedAt))?value.finishedAt:undefined};
  } catch { /* Older rounds have no run metadata. */ }
  return {id:createRoundId(),seconds:0};
}
export default function GracewardBibleQuest() {
  const { nodeId } = useParams();
  const adventure = useGracewardAdventure();
  const { companion } = useCompanion();
  const trail = BIBLE_TRAILS.find(item=>String(item.id)===nodeId);
  if(!trail) return <main className="gg-stage"><div className="gg-shell"><h1>Choose a trail to begin</h1><Link className="gg-cta" to="/play">Back to Play</Link></div></main>;
  return <QuestRound key={`${adventure.userId}:${trail.id}`} trail={trail} adventure={adventure} companion={companion}/>;
}
function QuestRound({trail,adventure,companion}:{trail:typeof BIBLE_TRAILS[number];adventure:ReturnType<typeof useGracewardAdventure>;companion:ReturnType<typeof useCompanion>["companion"]}) {
  const storageKey=`graceward:bible-quest:v1:${adventure.userId}:${trail.id}`;
  const [draft,setDraft]=useState(()=>parseQuestDraft(safeLocalStorage.getItem(storageKey),trail.id));
  const [run,setRun]=useState(()=>readRun(`${storageKey}:run`));
  const [started,setStarted]=useState(false);
  const [paused,setPaused]=useState(false);
  const [receipt,setReceipt]=useState<AdventureReceipt|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [draftSaved,setDraftSaved]=useState(true);
  const savingRef=useRef(false);
  const answerLock=useRef(false);
  const titleRef=useRef<HTMLHeadingElement>(null);
  const finishedAt=useRef(run.finishedAt||new Date().toISOString());
  const previousCompletion=adventure.completions.find(item=>item.node_id===trail.id);
  const unlocked=trail.id===1||adventure.completions.some(item=>item.node_id===trail.id-1);
  const finished=draft.answers.length===trail.questions.length&&!draft.revealed;
  const index=draft.revealed?draft.answers.length-1:draft.answers.length;
  const question=trail.questions[index];
  const correct=scoreBibleTrail(trail,draft.answers);
  const points=questPoints(draft.answers,trail.questions.map(item=>item.answer));
  const nextTrail=BIBLE_TRAILS.find(item=>item.id===trail.id+1);
  const {sound,toggleSound,cue}=useGameSound();
  const {seconds,resetClock}=useGameClock(started&&!finished,paused,()=>setPaused(true),run.seconds);
  const records=useGameRecords(adventure.userId);
  const best=records.bests[`bible-quest:trail-${trail.id}`]?.score;
  const result=useMemo<GameScore>(()=>({id:run.id,game:"bible-quest",mode:`trail-${trail.id}`,score:points,stars:correct===5?3:correct>=3?2:1,seconds,completedAt:finishedAt.current}),[run.id,trail.id,points,correct,seconds]);
  useEffect(()=>{setDraftSaved(safeLocalStorage.setItem(storageKey,JSON.stringify(draft)));},[draft,storageKey]);
  useEffect(()=>{safeLocalStorage.setItem(`${storageKey}:run`,JSON.stringify({id:run.id,seconds,finishedAt:finished?finishedAt.current:undefined}));},[run.id,seconds,finished,storageKey]);
  useEffect(()=>{if(started&&!draft.revealed)titleRef.current?.focus();},[started,index,draft.revealed]);
  async function save() {
    if(!finished||savingRef.current)return;
    savingRef.current=true;setSaving(true);setError("");
    try{setReceipt(await adventure.complete(trail.id,draft.answers));}catch(cause){setError(cause instanceof Error?cause.message:"Please try again.");}finally{savingRef.current=false;setSaving(false);}
  }
  function restart() {
    if(savingRef.current)return;
    setDraft({version:1,nodeId:trail.id,answers:[],revealed:false});setRun({id:createRoundId(),seconds:0});setReceipt(null);setError("");setStarted(false);setPaused(false);resetClock();answerLock.current=false;finishedAt.current=new Date().toISOString();
  }
  function answer(choiceIndex:number) {
    if(draft.revealed||paused||answerLock.current)return;
    answerLock.current=true;
    cue(choiceIndex===question.answer?"match":"miss");
    setDraft(current=>({...current,answers:[...current.answers,choiceIndex],revealed:true}));
  }
  function next() {answerLock.current=false;setDraft(current=>({...current,revealed:false}));if(index===4){finishedAt.current=new Date().toISOString();cue("finish");}}
  return <GameFrame title="Bible Quest" theme="quest" phase={finished?"finished":started?"playing":"intro"} paused={paused} onPause={()=>setPaused(true)} onResume={()=>setPaused(false)} onRestart={restart} sound={sound} toggleSound={toggleSound}>
    {!draftSaved&&<p className="gg-error" role="status">This device cannot save unfinished answers. Finish and collect your reward before leaving.</p>}
    {adventure.isLoading?<div className="gg-loading" role="status"><Sparkles/><p>Opening your trail…</p></div>:adventure.isError?<div className="gg-error" role="alert">Your progress couldn’t load.<button className="gg-secondary" onClick={()=>void adventure.refetch()}>Try again</button></div>
    :!unlocked||!companion||companion.current_stage<1?<section className="gg-word-panel"><h1>One step at a time</h1><p>Hatch your companion and complete the preceding trail to play here.</p><Link className="gg-cta" to="/play">Back to Play</Link></section>
    :finished?<GameFinale result={result} playerId={adventure.userId} title={correct===5?"A trail of bright discoveries.":"Every step tells a story."} description={`${correct} of 5 discoveries found. You’ve reached the end of ${trail.subtitle}.`} theme="quest" onReplay={restart}>
      <div className="gg-companion-finale"><AdventureCompanion companion={companion} celebrate={Boolean(receipt)}/></div>
      {receipt?<div className="gg-reward" role="status"><strong><Check size={17}/> Adventure saved</strong><span><Sparkles size={16}/>{receipt.xp_awarded} XP saved <Coins size={16}/>{receipt.coins_awarded} coins earned</span>{receipt.already_completed&&<small>This trail’s reward was already collected. Replays improve your personal best.</small>}</div>
      :previousCompletion?<p className="gg-fineprint">Your companion already received this trail’s reward. Replays still count toward your high scores.</p>
      :<><p className="gg-fineprint">Your game score is saved on this device. Collect your companion reward to unlock the next trail.</p><button className="gg-cta gg-reward-button" disabled={saving} onClick={()=>void save()}>{saving?"Saving your adventure…":"Collect my reward"}<Sparkles size={18}/></button></>}
      {error&&<p className="gg-error" role="alert">{error}</p>}
      {(receipt||previousCompletion)&&nextTrail&&<Link className="gg-secondary" to={`/play/bible-quest/${nextTrail.id}`}>Next adventure <ArrowRight size={18}/></Link>}
    </GameFinale>:!started?<GameIntro theme="quest" eyebrow={`BIBLE QUEST · ${trail.subtitle}`} title={trail.title} description="Follow five stepping stones through the story. Make discoveries, build a streak, and bring a reward home to your companion." best={best} onStart={()=>{setStarted(true);cue("tap");}} startLabel={draft.answers.length?"Resume trail":"Begin the trail"}>
      <div className="gg-quest-intro-stats"><span><BookOpen/>5 discoveries</span><span><Star/>3 stars to earn</span></div><p className="gg-rules">Correct answers earn 200 points. Each consecutive discovery adds 50 more. Take your time; every explanation is part of the journey.</p>
      {draft.answers.length>0&&<p className="gg-resume-note">Your place is saved · {draft.answers.length} of 5 answered</p>}
    </GameIntro>:question&&<>
      <GameHUD score={points} best={best} seconds={seconds} progress={`${Math.min(index+1,5)}/5`}/>
      <div className="gg-quest-map" aria-label={`Question ${index+1} of 5`}>{trail.questions.map((item,n)=><span key={n} className={n<draft.answers.length?(draft.answers[n]===item.answer?"is-found":"is-explored"):n===index?"is-current":""}>{n<draft.answers.length?<Star size={17} fill={draft.answers[n]===item.answer?"currentColor":"none"}/>:n+1}</span>)}</div>
      <section className="gg-question" aria-hidden={paused||undefined} inert={paused||undefined}><p className="gg-overline">{trail.subtitle} · DISCOVERY {index+1}</p><h1 ref={titleRef} tabIndex={-1}>{question.prompt}</h1>
        <div className="gg-answer-grid">{question.choices.map((choice,choiceIndex)=><button key={choice} disabled={draft.revealed} className={`gg-answer ${draft.revealed&&choiceIndex===question.answer?"is-correct":""} ${draft.revealed&&choiceIndex===draft.answers[index]&&choiceIndex!==question.answer?"is-chosen":""}`} onClick={()=>answer(choiceIndex)}><span aria-hidden="true">{draft.revealed&&choiceIndex===question.answer?<Check size={18}/>:String.fromCharCode(65+choiceIndex)}</span>{choice}</button>)}</div>
        {draft.revealed&&<div className={`gg-discovery ${draft.answers[index]===question.answer?"is-correct":""}`} role="status"><strong>{draft.answers[index]===question.answer?"A bright discovery!":`Let’s discover: ${question.choices[question.answer]}`}</strong><p>{question.explanation}</p><small><BookOpen size={15}/>{question.reference}</small><button className="gg-cta" onClick={next}>{index===4?"See my discoveries":"Next discovery"}<ArrowRight size={18}/></button></div>}
      </section><p className="gg-fineprint">Your place saves automatically. Pause whenever you need.</p>
    </>}
  </GameFrame>;
}
