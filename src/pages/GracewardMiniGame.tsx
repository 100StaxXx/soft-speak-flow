import { Link, useParams } from "react-router-dom";
import { GracewardPairs, GracewardVerseBuilder } from "@/components/graceward/GracewardGames";
import { useGracewardAdventure } from "@/hooks/useGracewardAdventure";
import "@/styles/gracewardGames.css";

export default function GracewardMiniGame() {
  const { gameId } = useParams();
  const { userId } = useGracewardAdventure();
  if (gameId === "noahs-pairs") return <GracewardPairs key={`${userId}:${gameId}`} playerId={userId}/>;
  if (gameId === "scripture-builder") return <GracewardVerseBuilder key={`${userId}:${gameId}`} playerId={userId}/>;
  return <main className="gg-stage"><div className="gg-shell"><h1>Choose your next adventure</h1><Link className="gg-cta" to="/play">Back to Play</Link></div></main>;
}
