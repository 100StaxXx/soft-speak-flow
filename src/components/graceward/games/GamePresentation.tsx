import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Crown, Pause, Play, RotateCcw, Sparkles, Star, Trophy, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatGameTime, saveGameScore, type GameScore, type GracewardGameId } from "@/lib/gracewardGameScores";
import { useGameRecords } from "./useGameSession";
import "@/styles/gracewardGames.css";

export const GAME_NAMES: Record<GracewardGameId, string> = { "noahs-pairs": "Noah’s Pairs", "scripture-builder": "Scripture Builder", "bible-quest": "Bible Quest" };
export const MODE_NAMES: Record<string, string> = { meadow: "Meadow · 6 pairs", voyage: "Voyage · 8 pairs", guided: "Guided journey", challenge: "Word challenge", "trail-1": "Creation Garden", "trail-2": "Promise Valley", "trail-3": "Parable Village" };
export type GamePhase = "intro" | "playing" | "finished";

export function GameFrame({ title, theme, phase, paused, onPause, onResume, onRestart, sound, toggleSound, children }: {
  title: string; theme: "ark" | "words" | "quest"; phase: GamePhase; paused: boolean; onPause: () => void; onResume: () => void; onRestart: () => void;
  sound: boolean; toggleSound: () => void; children: ReactNode;
}) {
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [phase, title]);
  return <main className={`gg-stage gg-${theme}`}>
    <div className="gg-world" aria-hidden="true"/><div className="gg-shell">
      <header className="gg-topbar">
        {phase === "playing" ? <button className="gg-icon" aria-label="Pause and exit options" onClick={onPause}><ArrowLeft/></button> : <Link className="gg-icon" to="/play" aria-label="Back to Play"><ArrowLeft/></Link>}
        <div><span className="gg-overline">GRACEWARD GAMES</span><strong>{title}</strong></div>
        <button className="gg-icon" onClick={toggleSound} aria-label={sound ? "Mute game sounds" : "Enable game sounds"} aria-pressed={sound}>{sound ? <Volume2/> : <VolumeX/>}</button>
        {phase === "playing" && <button className="gg-icon" aria-label="Pause game" onClick={onPause}><Pause/></button>}
      </header>
      {children}
    </div>
    <Dialog open={paused} onOpenChange={open => { if (!open) onResume(); }}><DialogContent className="gg-pause" hideCloseButton>
      <span className="gg-pause-mark"><Pause/></span><DialogTitle>Take a breath</DialogTitle>
      <DialogDescription>Your round is paused. Come back when you’re ready.</DialogDescription>
      <button className="gg-cta" onClick={onResume}><Play size={18}/> Resume game</button>
      <button className="gg-secondary" onClick={onRestart}><RotateCcw size={18}/> Restart round</button>
      <Link className="gg-exit" to="/play">Leave round · Back to Play</Link>
    </DialogContent></Dialog>
  </main>;
}

export function GameIntro({ eyebrow, title, description, theme, best, children, onStart, startLabel = "Let’s play" }: {
  eyebrow: string; title: string; description: string; theme: string; best?: number; children?: ReactNode; onStart: () => void; startLabel?: string;
}) {
  return <section className={`gg-intro gg-intro-${theme}`} aria-label={`${title} introduction`}>
    <div className="gg-intro-art" aria-hidden="true"><div className="gg-orbit"><Sparkles/></div><span className="gg-art-caption">A LITTLE WONDER AWAITS</span></div>
    <div className="gg-intro-body"><span className="gg-tag"><Trophy size={14}/>{best === undefined ? "Set your first high score" : `Personal best · ${best.toLocaleString()}`}</span>
      <p className="gg-overline">{eyebrow}</p><h1>{title}</h1><p className="gg-description">{description}</p>
      {children}<button className="gg-cta" onClick={onStart}><Play size={18} fill="currentColor"/>{startLabel}<ArrowRight size={18}/></button>
      <p className="gg-fineprint">No lives to lose. A new personal best to discover.</p>
    </div>
  </section>;
}

export function GameHUD({ score, best, seconds, progress, streak }: { score: number; best?: number; seconds: number; progress: string; streak?: number }) {
  return <div className="gg-hud" aria-label="Round stats">
    <div><span>SCORE</span><strong>{score.toLocaleString()}</strong></div><div><span>BEST</span><strong>{best?.toLocaleString() ?? "—"}</strong></div><div><span>TIME</span><strong>{formatGameTime(seconds)}</strong></div>
    <div className="gg-round-progress"><span>{streak && streak > 1 ? `${streak} IN A ROW` : "PROGRESS"}</span><strong>{progress}</strong></div>
  </div>;
}

export function FinaleScene({ theme }: { theme: "ark" | "words" | "quest" }) {
  return <div className={`gg-finale-scene gg-finale-${theme}`} aria-hidden="true">
    <div className="gg-sun"/><div className="gg-finale-rays"/>
    {theme === "ark" ? <svg className="gg-ark-boat" viewBox="0 0 240 150"><path d="M18 88h204l-23 40H49z" fill="#ae663b"/><path d="M22 94h197M42 112h166" stroke="#eab676" strokeWidth="5"/><path d="M60 42h122v46H60z" fill="#f3cc87"/><path d="M45 46l74-35 78 35z" fill="#694e46"/><rect x="105" y="56" width="26" height="32" rx="13" fill="#795741"/><circle cx="78" cy="66" r="8" fill="#7eb3a5"/><circle cx="165" cy="66" r="8" fill="#7eb3a5"/></svg>
      : theme === "words" ? <svg className="gg-book" viewBox="0 0 240 150"><path d="M27 42q48-23 93 0 45-23 93 0v88q-48-21-93 0-45-21-93 0z" fill="#ba8b47"/><path d="M32 31q44-21 88 0 44-21 88 0v88q-44-21-88 0-44-21-88 0z" fill="#fff3cc"/><path d="M120 31v88M49 53q27-12 52 0m-52 18q27-12 52 0m-52 18q27-12 52 0m38-36q27-12 52 0m-52 18q27-12 52 0m-52 18q27-12 52 0" fill="none" stroke="#c5ad76" strokeWidth="4"/></svg>
      : <div className="gg-laurel"><Trophy size={70} strokeWidth={1.4}/></div>}
    <div className="gg-wave gg-wave-one"/><div className="gg-wave gg-wave-two"/>
    {Array.from({length:16},(_,i)=><i className="gg-spark" key={i} style={{"--i":i} as CSSProperties}/>)}
  </div>;
}

export function GameFinale({ result, playerId, title, description, theme, onReplay, children }: {
  result: GameScore; playerId?: string; title: string; description: string; theme: "ark" | "words" | "quest"; onReplay: () => void; children?: ReactNode;
}) {
  const [record, setRecord] = useState<ReturnType<typeof saveGameScore> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setRecord(saveGameScore(playerId, result)); heading.current?.focus(); }, [playerId, result]);
  return <section className="gg-finale" aria-label="Round complete">
    <FinaleScene theme={theme}/><div className="gg-finale-body">
      <p className="gg-overline">{record?.newBest ? "A NEW PERSONAL BEST" : "ROUND COMPLETE"}</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p className="gg-description">{description}</p>
      <div className="gg-stars" aria-label={`${result.stars} of 3 stars`}>{[1,2,3].map(n=><Star key={n} className={n<=result.stars?"is-earned":""} fill="currentColor" style={{animationDelay:`${n*0.14}s`}}/>)}</div>
      <div className="gg-final-score"><span>YOUR SCORE</span><strong>{result.score.toLocaleString()}</strong></div>
      <div className="gg-result-stats"><span><Trophy size={15}/> Best {record?.records.bests[`${result.game}:${result.mode}`]?.score.toLocaleString() ?? result.score.toLocaleString()}</span><span>{formatGameTime(result.seconds)} played</span></div>
      <p className="gg-record-note" role="status">{record ? record.saved ? <><Check size={14}/> High score tracker updated · on this device</> : "Your score could not be saved on this device." : "Saving your score…"}</p>
      {children}<button className="gg-cta" onClick={onReplay}><RotateCcw size={18}/> Play again</button><Link to="/play" className="gg-secondary">Back to Play <ArrowRight size={18}/></Link>
    </div>
  </section>;
}

export function GameScoreboard({ playerId }: { playerId?: string }) {
  const records = useGameRecords(playerId);
  const [open,setOpen] = useState(false);
  return <section className="gg-scoreboard" aria-labelledby="gg-scores-title">
    <div className="gg-scoreboard-heading"><div><p className="gg-overline">YOUR TROPHY SHELF</p><h2 id="gg-scores-title">A little better, every play.</h2></div><Trophy/></div>
    <div className="gg-best-grid">{(Object.keys(GAME_NAMES) as GracewardGameId[]).map(game=>{
      const best = Object.values(records.bests).filter(row=>row.game===game).sort((a,b)=>b.score-a.score)[0];
      return <div key={game}><span>{GAME_NAMES[game]}</span><strong>{best?.score.toLocaleString() ?? "—"}</strong><small>{best ? MODE_NAMES[best.mode] : "Your first score awaits"}</small></div>;
    })}</div><button className="gg-scores-link" onClick={()=>setOpen(true)}>High scores & recent rounds <ArrowRight size={16}/></button>
    <p className="gg-fineprint">Personal records on this device · {records.rounds} completed rounds</p>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="gg-records-dialog"><DialogTitle>Your high scores</DialogTitle><DialogDescription>Personal bests for each game and mode. Saved to this account on this device.</DialogDescription>
      <div className="gg-records-scroll">{Object.values(records.bests).length ? Object.values(records.bests).map(row=><div className="gg-record-row" key={`${row.game}:${row.mode}`}><Crown size={19}/><div><strong>{GAME_NAMES[row.game]}</strong><small>{MODE_NAMES[row.mode] ?? row.mode}</small></div><b>{row.score.toLocaleString()}</b></div>) : <p>Finish a round to start your trophy shelf.</p>}
      <h3>Recent rounds</h3>{records.recent.slice(0,8).map(row=><div className="gg-record-row" key={row.id}><Star size={17}/><div><strong>{GAME_NAMES[row.game]}</strong><small>{MODE_NAMES[row.mode]} · {new Date(row.completedAt).toLocaleDateString()}</small></div><b>{row.score.toLocaleString()}</b></div>)}</div>
    </DialogContent></Dialog>
  </section>;
}
