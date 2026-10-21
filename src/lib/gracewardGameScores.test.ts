import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoundId, gameStorageKey, pairPoints, pairsTimeBonus, questPoints, readGameRecords, saveGameScore, versePoints, type GameScore } from "./gracewardGameScores";
const result=(score=1000,id=createRoundId()):GameScore=>({id,game:"noahs-pairs",mode:"meadow",score,stars:3,seconds:40,completedAt:"2026-10-21T10:00:00Z"});
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
describe("Graceward personal records",()=>{
 it("keeps personal bests across rounds and separates accounts and modes",()=>{
  saveGameScore("one",result(1000));saveGameScore("one",result(500));saveGameScore("one",{...result(2000),mode:"voyage"});saveGameScore("two",result(300));
  expect(readGameRecords("one").bests["noahs-pairs:meadow"].score).toBe(1000);
  expect(readGameRecords("one").bests["noahs-pairs:voyage"].score).toBe(2000);
  expect(readGameRecords("two").bests["noahs-pairs:meadow"].score).toBe(300);
  expect(readGameRecords("one").rounds).toBe(3);
 });
 it("deduplicates a remounted finale and never lowers an existing best",()=>{const score=result();expect(saveGameScore("one",score).newBest).toBe(true);saveGameScore("one",score);expect(readGameRecords("one").rounds).toBe(1);expect(saveGameScore("one",result(20)).newBest).toBe(false);});
 it("retains all-time bests after recent history is trimmed",()=>{saveGameScore("one",result(9000));for(let i=0;i<40;i++)saveGameScore("one",result(i));expect(readGameRecords("one").recent).toHaveLength(30);expect(readGameRecords("one").bests["noahs-pairs:meadow"].score).toBe(9000);});
 it("recovers from malformed storage and rejects invalid scores",()=>{localStorage.setItem(gameStorageKey("one"),"{");expect(readGameRecords("one").rounds).toBe(0);expect(saveGameScore("one",result(NaN)).saved).toBe(false);expect(saveGameScore("one",{...result(),stars:99}).saved).toBe(false);});
 it("reports storage failure without claiming the score was saved",()=>{vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("full");});expect(saveGameScore("one",result()).saved).toBe(false);});
 it("scores streaks, speed, hints and mistakes with bounded bonuses",()=>{expect(pairPoints(1)).toBe(200);expect(pairPoints(99)).toBe(400);expect(pairsTimeBonus(999,6)).toBe(0);expect(versePoints(99,10)).toBe(100);expect(questPoints([1,0,2,1,3],[1,0,2,1,3])).toBe(1500);expect(questPoints([1,9,2],[1,0,2])).toBe(400);});
});
