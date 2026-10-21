import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GracewardPairs } from "./NoahsPairs";
import { GracewardVerseBuilder } from "./ScriptureBuilder";
import { readGameRecords } from "@/lib/gracewardGameScores";
const mount=(game:React.ReactNode)=>render(<MemoryRouter>{game}</MemoryRouter>);
beforeEach(()=>{localStorage.clear();vi.spyOn(Math,"random").mockReturnValue(.9999);});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe("Noah’s Pairs game flow",()=>{
 it("starts at an introduction, blocks a third card, flips mismatches automatically, and pauses the clock",()=>{
  vi.useFakeTimers();mount(<GracewardPairs playerId="one"/>);
  expect(screen.queryByRole("button",{name:"Reveal card 1"})).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Set sail"}));
  fireEvent.click(screen.getByRole("button",{name:"Reveal card 1"}));fireEvent.click(screen.getByRole("button",{name:"Reveal card 3"}));expect(screen.getByRole("button",{name:"Reveal card 5"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Pause game"}));act(()=>vi.advanceTimersByTime(5000));expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Resume game"}));act(()=>vi.advanceTimersByTime(1000));expect(screen.getByRole("button",{name:"Reveal card 1"})).toBeEnabled();
 });
 it("finishes a real round, saves a best once, and replays from a fresh introduction",()=>{
  mount(<GracewardPairs playerId="one"/>);fireEvent.click(screen.getByRole("button",{name:"Set sail"}));
  for(let i=1;i<=12;i++)fireEvent.click(screen.getByRole("button",{name:`Reveal card ${i}`}));
  expect(screen.getByRole("heading",{name:"Everyone’s aboard."})).toBeInTheDocument();expect(screen.getByLabelText("3 of 3 stars")).toBeInTheDocument();expect(readGameRecords("one").rounds).toBe(1);expect(readGameRecords("one").bests["noahs-pairs:meadow"].score).toBeGreaterThan(1200);
  fireEvent.click(screen.getByRole("button",{name:"Play again"}));expect(screen.getByRole("button",{name:"Set sail"})).toBeInTheDocument();expect(screen.getByText(/Personal best ·/)).toBeInTheDocument();
 });
 it("starts the larger board without mixing difficulty records",()=>{mount(<GracewardPairs playerId="one"/>);fireEvent.click(screen.getByRole("button",{name:/Voyage/}));fireEvent.click(screen.getByRole("button",{name:"Set sail"}));expect(screen.getAllByRole("button",{name:/Reveal card/})).toHaveLength(16);});
});
describe("Scripture Builder game flow",()=>{
 it("plays three passages with feedback, hints and a persistent finale",()=>{
  mount(<GracewardVerseBuilder playerId="one"/>);fireEvent.click(screen.getByRole("button",{name:"Open the story"}));
  const guide=screen.getByLabelText("Passage guide").textContent!;const first=guide.split(/\s+/)[0];
  const wrong=within(screen.getByLabelText("Available words")).getAllByRole("button").find(button=>button.textContent!==first)!;fireEvent.click(wrong);expect(screen.getByRole("status")).toHaveTextContent("Not quite");
  fireEvent.click(screen.getByRole("button",{name:/Place next word/}));
  for(let round=0;round<3;round++){
    const words=screen.getByLabelText("Passage guide").textContent!.split(/\s+/);
    for(const word of words.slice(round===0?1:0)) {const bank=within(screen.getByLabelText("Available words"));fireEvent.click(bank.getAllByRole("button",{name:word}).find(button=>!button.hasAttribute("disabled"))!);}
    expect(screen.getByText("Passage restored")).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:round===2?"See my finale":"Next passage"}));
  }
  expect(screen.getByRole("heading",{name:"A little light to carry."})).toBeInTheDocument();expect(readGameRecords("one").rounds).toBe(1);expect(readGameRecords("one").bests["scripture-builder:guided"].score).toBe(760);
 });
 it("offers a memory challenge without exposing the full passage",()=>{mount(<GracewardVerseBuilder/>);fireEvent.click(screen.getByRole("button",{name:/Challenge/}));fireEvent.click(screen.getByRole("button",{name:"Open the story"}));expect(screen.queryByLabelText("Passage guide")).not.toBeInTheDocument();});
});
