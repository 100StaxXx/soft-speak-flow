import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Coins, Compass, Heart, LockKeyhole, Play, Settings, Sparkles, Star } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useGracewardAdventure } from "@/hooks/useGracewardAdventure";
import { BIBLE_TRAILS } from "@/data/gracewardBibleQuest";
import { AdventureCompanion } from "@/components/graceward/AdventureCompanion";
import "@/styles/gracewardAdventure.css";

export default function GracewardAdventure() {
  const { companion } = useCompanion();
  const { completions, isLoading, isError, refetch } = useGracewardAdventure();
  const playHub = useLocation().pathname === "/play";
  const next = BIBLE_TRAILS.find((trail) => !completions.some((item) => item.node_id === trail.id));
  const ready = !isLoading && !isError && Boolean(companion && companion.current_stage >= 1);
  return <main className="gw-adventure pt-safe pb-nav-safe">
    <div className="gw-shell">
      <header className="gw-header"><Link to="/adventure" className="gw-wordmark"><Sparkles aria-hidden="true" /> graceward<span>YOUR FAITH ADVENTURE</span></Link>
        <div className="gw-header-actions"><span className="gw-coin-count"><Coins size={18} aria-hidden="true" />{completions.reduce((sum, row) => sum + row.coins_awarded, 0)}<span className="sr-only"> earned coins</span></span><Link className="gw-icon-button" to="/profile" aria-label="Profile and settings"><Settings size={20} /></Link></div>
      </header>
      <section className="gw-hero">
        <div className="gw-cloud gw-cloud-one" aria-hidden="true" /><div className="gw-cloud gw-cloud-two" aria-hidden="true" />
        <div className="gw-hero-copy"><p className="gw-eyebrow">A little play. A little wonder.</p><h1>{playHub ? "Let’s play & discover." : "Big adventures.\nGrowing faith."}</h1><p>Explore Bible stories together, one joyful challenge at a time.</p></div>
        <AdventureCompanion companion={companion} />
        <span className="gw-companion-label">{companion?.companion_name || "Your companion"}<span>Ready for a new discovery</span></span>
        {ready ? <Link className="gw-button gw-button-gold" to={`/play/bible-quest/${next?.id ?? 1}`}><Play size={20} fill="currentColor" />{next ? "Continue playing" : "Play again"}<ArrowRight size={19} /></Link>
          : !companion && !isLoading ? <Link className="gw-button gw-button-gold" to="/companion">Meet your companion <ArrowRight size={18} /></Link>
          : <p role="status" className="gw-hero-status">{isError ? "Reconnect to load your adventure." : companion?.current_stage === 0 ? "Hatch your companion to begin your adventure." : "Loading your adventure…"}</p>}
        {companion?.current_stage === 0 && <Link className="gw-text-link" to="/companion">Visit your companion</Link>}
      </section>
      <section className="gw-trails" aria-labelledby="gw-trail-heading"><div className="gw-section-heading"><div><p className="gw-eyebrow">BIBLE QUEST · CHAPTER ONE</p><h2 id="gw-trail-heading">Your path of discovery</h2></div><span className="gw-progress-pill">{completions.length} / {BIBLE_TRAILS.length}</span></div>
        <p className="gw-muted">Five questions. New discoveries. A reward to share.</p>
        {isError && <div role="alert" className="gw-error">Your progress couldn't load.<button className="gw-text-link" onClick={() => void refetch()}>Try again</button></div>}
        <ol className="gw-trail-list">{BIBLE_TRAILS.map((trail, index) => {
          const completion = completions.find((item) => item.node_id === trail.id);
          const unlocked = ready && (index === 0 || completions.some((item) => item.node_id === trail.id - 1));
          const content = <><span className={`gw-node gw-node-${index}`}>{completion ? <Check /> : unlocked ? <Star fill="currentColor" /> : <LockKeyhole size={21} />}</span><span className="gw-trail-copy"><small>{trail.subtitle}</small><strong>{trail.title}</strong><span>{completion ? `${completion.score}/5 discoveries · Play again` : unlocked ? "5 questions · Earn up to 20 XP + 10 coins" : "Complete the previous trail to unlock"}</span></span>{unlocked && <ArrowRight size={20} />}</>;
          return <li key={trail.id}>{unlocked ? <Link className="gw-trail-card" to={`/play/bible-quest/${trail.id}`}>{content}</Link> : <div className="gw-trail-card gw-locked" aria-disabled="true">{content}</div>}</li>;
        })}</ol>
      </section>
      <section className="gw-quiet-cards" aria-label="More ways to grow"><Link to="/companion"><Heart /><strong>A friend for your journey</strong><span>Visit your companion <ArrowRight size={15} /></span></Link><Link to="/mentor"><BookOpen /><strong>A quiet moment with God</strong><span>Scripture & prayer <ArrowRight size={15} /></span></Link></section>
      <Link className="gw-guide-link" to="/guide"><Compass size={18} /> Talk with your faith guide <ArrowRight size={17} /></Link>
    </div>
  </main>;
}
