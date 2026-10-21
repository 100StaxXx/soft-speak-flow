import { Link } from "react-router-dom";
import { ArrowRight, Check, Coins, LockKeyhole, Play, Settings, Sparkles, Star } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useGracewardAdventure } from "@/hooks/useGracewardAdventure";
import { BIBLE_TRAILS } from "@/data/gracewardBibleQuest";
import "@/styles/gracewardAdventure.css";
import { GameScoreboard } from "@/components/graceward/games/GamePresentation";

export default function GracewardAdventure() {
  const { companion } = useCompanion();
  const { completions, isLoading, isError, refetch, userId } = useGracewardAdventure();
  const next = BIBLE_TRAILS.find((trail) => !completions.some((item) => item.node_id === trail.id));
  const ready = !isLoading && !isError && Boolean(companion && companion.current_stage >= 1);
  return <main className="gw-adventure gg-lobby pt-safe pb-nav-safe">
    <div className="gw-shell">
      <header className="gw-header"><Link to="/play" className="gw-wordmark"><Sparkles aria-hidden="true" /> graceward<span>PLAY & DISCOVER</span></Link>
        <div className="gw-header-actions"><span className="gw-coin-count"><Coins size={18} aria-hidden="true" />{completions.reduce((sum, row) => sum + row.coins_awarded, 0)}<span className="sr-only"> earned coins</span></span><Link className="gw-icon-button" to="/profile" aria-label="Profile and settings"><Settings size={20} /></Link></div>
      </header>
      <div className="gw-play-heading"><h1>Play</h1><p>Three little worlds. One more adventure.</p></div>
      <section className="gw-hero gw-play-feature" aria-labelledby="gw-bible-title">
        <div className="gg-lobby-hero-art" aria-hidden="true" />
        <p className="gw-eyebrow">STORIES, DISCOVERIES & REWARDS</p><h2 id="gw-bible-title">Bible Quest</h2>
        <p>Explore Bible stories in five-question trails. Collect rewards that help your companion grow.</p>
        {ready ? <Link className="gw-button gw-button-gold" to={`/play/bible-quest/${next?.id ?? 1}`}><Play size={20} fill="currentColor" />{completions.length ? next ? "Continue Bible Quest" : "Play Bible Quest again" : "Start Bible Quest"}<ArrowRight size={19} /></Link>
          : !companion && !isLoading ? <Link className="gw-button gw-button-gold" to="/companion">Meet your companion <ArrowRight size={18} /></Link>
          : <p role="status" className="gw-hero-status">{isError ? "Reconnect to load Bible Quest." : companion?.current_stage === 0 ? "Hatch your companion to begin Bible Quest." : "Loading Bible Quest…"}</p>}
        {companion?.current_stage === 0 && <Link className="gw-text-link" to="/companion">Visit your companion</Link>}
      </section>
      <section className="gw-more-games" aria-labelledby="gw-more-games-title"><h2 id="gw-more-games-title">A little more play</h2>
        <div className="gw-game-grid">
          <Link className="gw-game-tile" to="/play/noahs-pairs"><span className="gg-game-cover gg-cover-ark" aria-hidden="true"/><h3>Noah’s Pairs</h3><p>Find pairs. Build streaks. Bring everyone aboard.</p><span>Play pairs <ArrowRight size={16} /></span></Link>
          <Link className="gw-game-tile" to="/play/scripture-builder"><span className="gg-game-cover gg-cover-words" aria-hidden="true"/><h3>Scripture Builder</h3><p>Three passages. A little challenge. A bright finish.</p><span>Build a passage <ArrowRight size={16} /></span></Link>
        </div>
      </section>
      <GameScoreboard playerId={userId}/>
      <section className="gw-trails" aria-labelledby="gw-trail-heading"><div className="gw-section-heading"><div><p className="gw-eyebrow">BIBLE QUEST · CHAPTER ONE</p><h2 id="gw-trail-heading">Choose your trail</h2></div><span className="gw-progress-pill">{completions.length} / {BIBLE_TRAILS.length}</span></div>
        <p className="gw-muted">Five questions. New discoveries. A reward to share.</p>
        {isError && <div role="alert" className="gw-error">Your progress couldn't load.<button className="gw-text-link" onClick={() => void refetch()}>Try again</button></div>}
        <ol className="gw-trail-list">{BIBLE_TRAILS.map((trail, index) => {
          const completion = completions.find((item) => item.node_id === trail.id);
          const unlocked = ready && (index === 0 || completions.some((item) => item.node_id === trail.id - 1));
          const content = <><span className={`gw-node gw-node-${index}`}>{completion ? <Check /> : unlocked ? <Star fill="currentColor" /> : <LockKeyhole size={21} />}</span><span className="gw-trail-copy"><small>{trail.subtitle}</small><strong>{trail.title}</strong><span>{completion ? `${completion.score}/5 discoveries · Play again` : unlocked ? "5 questions · Earn up to 20 XP + 10 coins" : "Complete the previous trail to unlock"}</span></span>{unlocked && <ArrowRight size={20} />}</>;
          return <li key={trail.id}>{unlocked ? <Link className="gw-trail-card" to={`/play/bible-quest/${trail.id}`}>{content}</Link> : <div className="gw-trail-card gw-locked" aria-disabled="true">{content}</div>}</li>;
        })}</ol>
      </section>
    </div>
  </main>;
}
