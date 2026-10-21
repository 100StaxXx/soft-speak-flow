import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { GracewardQuietPause } from "@/components/graceward/GracewardQuietPause";
import "@/styles/gracewardAdventure.css";

const FocusActivity = lazy(() => import("@/components/companion/FocusTab").then(module => ({ default: module.FocusTab })));

export default function GracewardSanctuaryActivity() {
  const { activityId } = useParams();
  const title = activityId === "focus" ? "Focus time" : activityId === "quiet-pause" ? "Quiet pause" : "Sanctuary";
  return <main className="gw-adventure gw-activity-page pt-safe pb-nav-safe"><div className="gw-shell gw-game-shell">
    <header className="gw-game-header"><Link to="/mentor" className="gw-icon-button" aria-label="Back to Sanctuary"><ArrowLeft /></Link><div><p className="gw-eyebrow">SANCTUARY</p><h1>{title}</h1></div></header>
    <div className="gw-activity-card">{activityId === "quiet-pause" ? <GracewardQuietPause /> : activityId === "focus" ? <Suspense fallback={<p role="status">Preparing your focus space…</p>}><FocusActivity enableCosmiqCinema={false} /></Suspense> : <Link className="gw-button" to="/mentor">Back to Sanctuary</Link>}</div>
  </div></main>;
}
