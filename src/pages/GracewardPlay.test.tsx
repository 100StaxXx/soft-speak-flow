import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useCompanion", () => ({ useCompanion: () => ({ companion: { current_stage: 1 } }) }));
vi.mock("@/hooks/useGracewardAdventure", () => ({ useGracewardAdventure: () => ({ completions: [], isLoading: false, isError: false, refetch: vi.fn() }) }));
import GracewardAdventure from "./GracewardAdventure";
import GracewardMiniGame from "./GracewardMiniGame";
import { GracewardSanctuaryTools } from "@/components/graceward/GracewardSanctuaryTools";
function renderPlay() { render(<MemoryRouter initialEntries={["/play"]}><Routes><Route path="/play" element={<GracewardAdventure/>}/><Route path="/play/:gameId" element={<GracewardMiniGame/>}/></Routes></MemoryRouter>); }
describe("Graceward Play routes", () => {
 it("offers all three games from Play", () => { renderPlay(); expect(screen.getByRole("link", {name: /Start Bible Quest/})).toHaveAttribute("href", "/play/bible-quest/1"); expect(screen.getByRole("link", {name: /Noah’s Pairs/})).toHaveAttribute("href", "/play/noahs-pairs"); expect(screen.getByRole("link", {name: /Scripture Builder/})).toHaveAttribute("href", "/play/scripture-builder"); });
 it("opens an actual pairs round and returns to Play", () => { renderPlay(); fireEvent.click(screen.getByRole("link", {name: /Noah’s Pairs/})); fireEvent.click(screen.getByRole("button", {name: "Set sail"})); fireEvent.click(screen.getByRole("button", {name: "Reveal card 1"})); expect(screen.queryByRole("button", {name: "Reveal card 1"})).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", {name:"Pause and exit options"})); fireEvent.click(screen.getByRole("link", {name: /Leave round/})); expect(screen.getByRole("heading", {name:"Play"})).toBeInTheDocument(); });
 it("opens an actual Scripture round", () => { renderPlay(); fireEvent.click(screen.getByRole("link", {name:/Scripture Builder/})); fireEvent.click(screen.getByRole("button", {name:"Open the story"})); expect(screen.getByLabelText("Available words")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", {name:"Pause game"})); expect(screen.getByRole("link", {name:/Leave round/})).toHaveAttribute("href", "/play"); });
 it("puts reflection and focus under Sanctuary", () => { render(<MemoryRouter><GracewardSanctuaryTools/></MemoryRouter>); expect(screen.getByRole("link", {name:"Quiet pause"})).toHaveAttribute("href", "/mentor/quiet-pause"); expect(screen.getByRole("link", {name:"Focus time"})).toHaveAttribute("href", "/mentor/focus"); });
});
