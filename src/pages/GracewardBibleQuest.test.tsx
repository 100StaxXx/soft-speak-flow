import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BIBLE_TRAILS, parseQuestDraft } from "@/data/gracewardBibleQuest";
import GracewardBibleQuest from "./GracewardBibleQuest";

const mocks = vi.hoisted(() => ({ complete: vi.fn(), completions: [] as { node_id: number; score: number; xp_awarded: number; coins_awarded: number }[] }));
vi.mock("@/hooks/useGracewardAdventure", () => ({ useGracewardAdventure: () => ({
  userId: "test-user", completions: mocks.completions, complete: mocks.complete, isLoading: false, isError: false,
}) }));
vi.mock("@/hooks/useCompanion", () => ({ useCompanion: () => ({ companion: { current_stage: 1, spirit_animal: "lamb", core_element: "light", current_image_url: "/lamb.webp" } }) }));
vi.mock("@/components/graceward/AdventureCompanion", () => ({ AdventureCompanion: ({ celebrate }: { celebrate: boolean }) => <div data-testid="companion" data-celebrate={String(Boolean(celebrate))} /> }));
const key = "graceward:bible-quest:v1:test-user:1";
const renderRound = (node = 1) => render(<MemoryRouter initialEntries={[`/play/bible-quest/${node}`]}><Routes><Route path="/play/bible-quest/:nodeId" element={<GracewardBibleQuest />} /></Routes></MemoryRouter>);

beforeEach(() => { localStorage.clear(); mocks.complete.mockReset(); mocks.completions = []; });
afterEach(cleanup);
describe("Bible Quest recovery and reward flow", () => {
  it("restores an answered question and its explanation after leaving the game", () => {
    const view = renderRound();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(screen.getByText("Genesis 1:3–5")).toBeInTheDocument();
    view.unmount(); renderRound();
    expect(screen.getByRole("button", { name: "Next discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Light/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next discovery" }));
    expect(screen.getByRole("heading", { name: BIBLE_TRAILS[0].questions[1].prompt })).toBeInTheDocument();
  });
  it("keeps answers after a save failure and celebrates only a confirmed reward", async () => {
    localStorage.setItem(key, JSON.stringify({ version: 1, nodeId: 1, answers: [1,0,2,1,3], revealed: false }));
    mocks.complete.mockRejectedValueOnce(new Error("Reconnect and try again")).mockResolvedValueOnce({ node_id: 1, score: 5, xp_awarded: 20, coins_awarded: 10, already_completed: false });
    renderRound();
    fireEvent.click(screen.getByRole("button", { name: "Collect my reward" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("companion")).toHaveAttribute("data-celebrate", "false");
    expect(JSON.parse(localStorage.getItem(key)!).answers).toEqual([1,0,2,1,3]);
    fireEvent.click(screen.getByRole("button", { name: "Collect my reward" }));
    await screen.findByText("Adventure saved");
    expect(screen.getByTestId("companion")).toHaveAttribute("data-celebrate", "true");
    expect(screen.getByRole("link", { name: "Next adventure" })).toHaveAttribute("href", "/play/bible-quest/2");
    expect(mocks.complete).toHaveBeenLastCalledWith(1, [1,0,2,1,3]);
  });
  it("blocks a second save while the first is pending", async () => {
    localStorage.setItem(key, JSON.stringify({ version: 1, nodeId: 1, answers: [1,0,2,1,3], revealed: false }));
    mocks.complete.mockImplementation(() => new Promise(() => {}));
    renderRound(); fireEvent.click(screen.getByRole("button", { name: "Collect my reward" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving your adventure…" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Saving your adventure…" }));
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });
  it("does not expose a locked trail through a direct link", () => {
    renderRound(2);
    expect(screen.getByRole("heading", { name: "One step at a time" })).toBeInTheDocument();
    expect(screen.queryByText(BIBLE_TRAILS[1].questions[0].prompt)).not.toBeInTheDocument();
  });
  it("lets a player replay a collected trail without another award", () => {
    mocks.completions = [{ node_id: 1, score: 5, xp_awarded: 20, coins_awarded: 10 }];
    localStorage.setItem(key, JSON.stringify({ version: 1, nodeId: 1, answers: [1,0,2,1,3], revealed: false }));
    renderRound();
    expect(screen.queryByRole("button", { name: "Collect my reward" })).not.toBeInTheDocument();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("discards corrupt or cross-level saved answers", () => {
    for (const raw of ["{", '{"version":1,"nodeId":2,"answers":[],"revealed":false}', '{"version":1,"nodeId":1,"answers":[99],"revealed":true}']) {
      expect(parseQuestDraft(raw, 1)).toEqual({ version: 1, nodeId: 1, answers: [], revealed: false });
    }
  });
});
