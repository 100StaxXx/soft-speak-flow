import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { GracewardPairs, GracewardVerseBuilder } from "@/components/graceward/GracewardGames";
import "@/styles/gracewardAdventure.css";

export default function GracewardMiniGame() {
  const { gameId } = useParams();
  const title = gameId === "noahs-pairs" ? "Noah’s Pairs" : gameId === "scripture-builder" ? "Scripture Builder" : "Choose a game";
  return <main className="gw-adventure gw-activity-page pt-safe pb-nav-safe"><div className="gw-shell gw-game-shell">
    <header className="gw-game-header"><Link to="/play" className="gw-icon-button" aria-label="Back to Play"><ArrowLeft /></Link><div><p className="gw-eyebrow">PLAY</p><h1>{title}</h1></div></header>
    <div className="gw-activity-card">{gameId === "noahs-pairs" ? <GracewardPairs /> : gameId === "scripture-builder" ? <GracewardVerseBuilder /> : <Link className="gw-button" to="/play">Back to Play</Link>}</div>
    <p className="gw-game-note">Play at your own pace. You can start a fresh round any time.</p>
  </div></main>;
}
