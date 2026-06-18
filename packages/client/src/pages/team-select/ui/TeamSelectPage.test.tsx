import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameState } from "@codenames/shared";
import { TeamSelectPage } from "./TeamSelectPage";

const mutate = vi.fn();
const selectTeamState = {
  mutate,
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("../api/use-select-team", () => ({
  useSelectTeam: () => selectTeamState,
}));

function buildGameState(): PublicGameState {
  return {
    roomCode: "MAIN",
    phase: "lobby",
    players: [
      { id: "p1", name: "Alice", team: null, role: "operative", isReady: false, connected: true },
      { id: "p2", name: "Bob", team: "red", role: "operative", isReady: false, connected: true },
      { id: "p3", name: "Carol", team: "blue", role: "operative", isReady: false, connected: true },
    ],
    cards: [],
    turn: "red",
    currentClue: null,
    teams: {
      red: { color: "red", remaining: 9 },
      blue: { color: "blue", remaining: 8 },
    },
    winner: null,
    winReason: null,
    viewerRole: "operative",
  };
}

describe("TeamSelectPage", () => {
  beforeEach(() => {
    mutate.mockClear();
    selectTeamState.isPending = false;
    selectTeamState.isError = false;
    selectTeamState.error = null;
  });

  it("lists current members of each team", () => {
    render(<TeamSelectPage gameState={buildGameState()} myPlayerId="p1" />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("submits a team selection", async () => {
    const user = userEvent.setup();
    render(<TeamSelectPage gameState={buildGameState()} myPlayerId="p1" />);

    await user.click(screen.getByRole("button", { name: "Join Red" }));
    expect(mutate).toHaveBeenCalledWith({ team: "red" });
  });

  it("disables the button for the team the player already joined", () => {
    const state = buildGameState();
    state.players[0].team = "red";
    render(<TeamSelectPage gameState={state} myPlayerId="p1" />);

    expect(screen.getByRole("button", { name: "Joined" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Join Blue" })).toBeEnabled();
  });

  it("shows the mutation error message", () => {
    selectTeamState.isError = true;
    selectTeamState.error = new Error("Spectators cannot select a team");
    render(<TeamSelectPage gameState={buildGameState()} myPlayerId="p1" />);

    expect(screen.getByText("Spectators cannot select a team")).toBeInTheDocument();
  });
});
