import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, Coins, RotateCcw, Sparkles, Star } from "lucide-react";
import { BIBLE_TRAILS, parseQuestDraft, scoreBibleTrail } from "@/data/gracewardBibleQuest";
import { useGracewardAdventure, type AdventureReceipt } from "@/hooks/useGracewardAdventure";
import { useCompanion } from "@/hooks/useCompanion";
import { safeLocalStorage } from "@/utils/storage";
import { AdventureCompanion } from "@/components/graceward/AdventureCompanion";
import "@/styles/gracewardAdventure.css";

export default function GracewardBibleQuest() {
  const { nodeId } = useParams();
  const adventure = useGracewardAdventure();
  const { companion } = useCompanion();
  const trail = BIBLE_TRAILS.find((item) => String(item.id) === nodeId);
  if (!trail) return <main className="gw-adventure pt-safe pb-nav-safe"><div className="gw-shell"><h1>Choose a trail to begin</h1><Link to="/play">Back to games</Link></div></main>;
  return <QuestRound key={`${adventure.userId}:${trail.id}`} trail={trail} adventure={adventure} companion={companion} />;
}

function QuestRound({ trail, adventure, companion }: {
  trail: typeof BIBLE_TRAILS[number]; adventure: ReturnType<typeof useGracewardAdventure>; companion: ReturnType<typeof useCompanion>["companion"];
}) {
  const storageKey = `graceward:bible-quest:v1:${adventure.userId}:${trail.id}`;
  const [draft, setDraft] = useState(() => parseQuestDraft(safeLocalStorage.getItem(storageKey), trail.id));
  const [receipt, setReceipt] = useState<AdventureReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftSaved, setDraftSaved] = useState(true);
  const savingRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousCompletion = adventure.completions.find((item) => item.node_id === trail.id);
  const unlocked = trail.id === 1 || adventure.completions.some((item) => item.node_id === trail.id - 1);
  const finished = draft.answers.length === trail.questions.length && !draft.revealed;
  const index = draft.revealed ? draft.answers.length - 1 : draft.answers.length;
  const question = trail.questions[index];
  const score = scoreBibleTrail(trail, draft.answers);
  const nextTrail = BIBLE_TRAILS.find((item) => item.id === trail.id + 1);
  useEffect(() => { setDraftSaved(safeLocalStorage.setItem(storageKey, JSON.stringify(draft))); }, [draft, storageKey]);
  useEffect(() => { if (!draft.revealed) titleRef.current?.focus(); }, [index, draft.revealed]);

  const save = async () => {
    if (!finished || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError("");
    try { setReceipt(await adventure.complete(trail.id, draft.answers)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const restart = () => { setDraft({ version: 1, nodeId: trail.id, answers: [], revealed: false }); setReceipt(null); setError(""); };

  return <main className="gw-adventure gw-game-page pt-safe pb-nav-safe"><div className="gw-shell gw-game-shell">
    <header className="gw-game-header"><Link to="/play" className="gw-icon-button" aria-label="Save and return to Play"><ArrowLeft /></Link><div><p className="gw-eyebrow">BIBLE QUEST</p><strong>{trail.subtitle}</strong></div><span className="gw-progress-pill">{Math.min(index + 1, 5)} / 5</span></header>
    {!draftSaved && <p className="gw-error" role="status">This device cannot save unfinished answers. Finish and collect your reward before leaving.</p>}
    {adventure.isLoading ? <p role="status">Loading your trail…</p> : adventure.isError ? <div className="gw-error" role="alert">Your progress couldn't load.<button className="gw-button" onClick={() => void adventure.refetch()}>Try again</button></div>
    : !unlocked || !companion || companion.current_stage < 1 ? <section className="gw-question-card"><h1>One step at a time</h1><p>Hatch your companion and complete the preceding trail to play here.</p><Link className="gw-button" to="/play">Back to Play</Link></section>
    : finished ? <section className="gw-question-card gw-results" aria-labelledby="gw-result-title">
      <span className="gw-result-icon"><Star fill="currentColor" /></span><p className="gw-eyebrow">A NEW DISCOVERY</p><h1 id="gw-result-title">Look how far you’ve come!</h1><p>You answered {score} of 5 correctly and explored every explanation.</p>
      <AdventureCompanion companion={companion} celebrate={Boolean(receipt)} />
      {receipt ? <div className="gw-saved-reward" role="status"><strong><Check size={18} /> Adventure saved</strong><span><Sparkles size={17} /> {receipt.xp_awarded} XP saved <Coins size={17} /> {receipt.coins_awarded} coins earned</span>{receipt.already_completed && <small>This trail's reward was already collected. Replays are for discovery.</small>}</div>
      : previousCompletion ? <p className="gw-muted">You’ve already earned this trail’s reward. Thanks for exploring it again!</p>
      : <><p className="gw-muted">Save this discovery to grow your companion and unlock the next trail.</p><button className="gw-button gw-button-gold" disabled={saving} onClick={() => void save()}>{saving ? "Saving your adventure…" : "Collect my reward"}<Sparkles size={19} /></button></>}
      {error && <p className="gw-error" role="alert">{error}</p>}
      {(receipt || previousCompletion) && (nextTrail ? <Link className="gw-button" to={`/play/bible-quest/${nextTrail.id}`}>Next adventure <ArrowRight size={19} /></Link> : <Link className="gw-button" to="/play">Chapter complete! Back to Play <ArrowRight size={19} /></Link>)}
      <button className="gw-text-link" disabled={saving} onClick={restart}><RotateCcw size={16} /> Play this trail again</button>
    </section> : question && <>
      <div className="gw-question-progress" aria-label={`Question ${index + 1} of 5`}>{trail.questions.map((_, position) => <span key={position} className={position <= index ? "gw-progress-active" : ""} />)}</div>
      <section className="gw-question-card"><p className="gw-eyebrow">{trail.title}</p><h1 ref={titleRef} tabIndex={-1}>{question.prompt}</h1>
        <div className="gw-answers">{question.choices.map((choice, choiceIndex) => <button key={choice} disabled={draft.revealed}
          className={`gw-answer ${draft.revealed && choiceIndex === question.answer ? "gw-answer-correct" : ""} ${draft.revealed && choiceIndex === draft.answers[index] && choiceIndex !== question.answer ? "gw-answer-selected" : ""}`}
          onClick={() => setDraft((current) => current.revealed ? current : { ...current, answers: [...current.answers, choiceIndex], revealed: true })}>
          <span aria-hidden="true">{draft.revealed && choiceIndex === question.answer ? <Check size={18} /> : String.fromCharCode(65 + choiceIndex)}</span>{choice}
        </button>)}</div>
        {draft.revealed && <div className="gw-explanation" role="status"><strong>{draft.answers[index] === question.answer ? "You found it!" : `Let's discover: ${question.choices[question.answer]}`}</strong><p>{question.explanation}</p><small><BookOpen size={15} /> {question.reference}</small><button className="gw-button" onClick={() => setDraft((current) => ({ ...current, revealed: false }))}>{index === 4 ? "See my discoveries" : "Next discovery"}<ArrowRight size={18} /></button></div>}
      </section><p className="gw-game-note">Take your time. Every discovery is a step forward.</p>
    </>}
  </div></main>;
}
