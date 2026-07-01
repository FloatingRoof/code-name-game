import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameState } from "@codenames/shared";
import { LobbyPage } from "./LobbyPage";

const becomeCaptainMutate = vi.fn();
const stepDownCaptainMutate = vi.fn();
const playerReadyMutate = vi.fn();
const startGameMutate = vi.fn();
const startGameReset = vi.fn();

const becomeCaptainState = {
  mutate: becomeCaptainMutate,
  isPending: false,
  error: null as Error | null,
};
const stepDownCaptainState = {
  mutate: stepDownCaptainMutate,
  isPending: false,
  error: null as Error | null,
};
const playerReadyState = {
  mutate: playerReadyMutate,
  isPending: false,
  error: null as Error | null,
};
const startGameState = {
  mutate: startGameMutate,
  reset: startGameReset,
  isPending: false,
  isError: false,
  error: null as Error | null,
};

let gameState: PublicGameState;

vi.mock("../api/use-become-captain", () => ({
  useBecomeCaptain: () => becomeCaptainState,
}));
vi.mock("../api/use-step-down-captain", () => ({
  useStepDownCaptain: () => stepDownCaptainState,
}));
vi.mock("../api/use-player-ready", () => ({
  usePlayerReady: () => playerReadyState,
}));
vi.mock("../api/use-start-game", () => ({
  useStartGame: () => startGameState,
}));

vi.mock("../../../shared/socket", () => ({
  useGameState: () => ({ data: gameState }),
}));

function buildGameState(): PublicGameState {
  return {
    roomCode: "MAIN",
    phase: "lobby",
    players: [
      {
        id: "p1",
        name: "Alice",
        team: "red",
        role: "operative",
        isReady: false,
        connected: true,
      },
      {
        id: "p2",
        name: "Bob",
        team: "red",
        role: "captain",
        isReady: true,
        connected: true,
      },
      {
        id: "p3",
        name: "Carol",
        team: "blue",
        role: "operative",
        isReady: false,
        connected: true,
      },
    ],
    cards: [],
    turn: "red",
    currentClue: null,
    selectedCardIds: [],
    teams: {
      red: { color: "red", remaining: 9 },
      blue: { color: "blue", remaining: 8 },
    },
    winner: null,
    winReason: null,
    viewerRole: "operative",
    minPlayersPerTeam: 2,
  };
}

describe("LobbyPage", () => {
  beforeEach(() => {
    becomeCaptainMutate.mockClear();
    stepDownCaptainMutate.mockClear();
    playerReadyMutate.mockClear();
    startGameMutate.mockClear();
    startGameReset.mockClear();
    becomeCaptainState.isPending = false;
    becomeCaptainState.error = null;
    stepDownCaptainState.isPending = false;
    stepDownCaptainState.error = null;
    playerReadyState.isPending = false;
    playerReadyState.error = null;
    startGameState.isPending = false;
    startGameState.isError = false;
    startGameState.error = null;
    gameState = buildGameState();
  });

  it("lists both team rosters with ready state", () => {
    render(<LobbyPage myPlayerId="p1" />);

    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Carol/)).toBeInTheDocument();
    expect(screen.getAllByText("Ready")).toHaveLength(1);
    expect(screen.getAllByText("Waiting")).toHaveLength(2);
  });

  it("lets a non-captain become captain of their own team", async () => {
    const user = userEvent.setup();
    render(<LobbyPage myPlayerId="p1" />);

    await user.click(screen.getByRole("button", { name: "Become captain" }));
    expect(becomeCaptainMutate).toHaveBeenCalledWith({ team: "red" });
  });

  it("shows a step-down button instead of become-captain once the player is captain", () => {
    render(<LobbyPage myPlayerId="p2" />);

    expect(screen.queryByRole("button", { name: "Become captain" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step down as captain" })).toBeInTheDocument();
  });

  it("lets a captain step down, re-selecting their own team", async () => {
    const user = userEvent.setup();
    render(<LobbyPage myPlayerId="p2" />);

    await user.click(screen.getByRole("button", { name: "Step down as captain" }));
    expect(stepDownCaptainMutate).toHaveBeenCalledWith({ team: "red" });
  });

  it("toggles ready state", async () => {
    const user = userEvent.setup();
    render(<LobbyPage myPlayerId="p1" />);

    await user.click(screen.getByRole("button", { name: "Ready up" }));
    expect(playerReadyMutate).toHaveBeenCalledWith({ ready: true });
  });

  it("does not auto-start while a team has fewer than two ready players", () => {
    render(<LobbyPage myPlayerId="p1" />);

    expect(startGameMutate).not.toHaveBeenCalled();
  });

  it("automatically starts once both teams have at least two ready players and a captain", () => {
    gameState.players = [
      { id: "p1", name: "Alice", team: "red", role: "captain", isReady: true, connected: true },
      { id: "p2", name: "Bob", team: "red", role: "operative", isReady: true, connected: true },
      { id: "p3", name: "Carol", team: "blue", role: "captain", isReady: true, connected: true },
      { id: "p4", name: "Dan", team: "blue", role: "operative", isReady: true, connected: true },
    ];
    render(<LobbyPage myPlayerId="p1" />);

    expect(startGameMutate).toHaveBeenCalled();
  });

  it("respects the server-provided minPlayersPerTeam instead of a hardcoded value", () => {
    gameState.minPlayersPerTeam = 3;
    gameState.players = [
      { id: "p1", name: "Alice", team: "red", role: "captain", isReady: true, connected: true },
      { id: "p2", name: "Bob", team: "red", role: "operative", isReady: true, connected: true },
      { id: "p3", name: "Carol", team: "blue", role: "captain", isReady: true, connected: true },
      { id: "p4", name: "Dan", team: "blue", role: "operative", isReady: true, connected: true },
    ];
    render(<LobbyPage myPlayerId="p1" />);

    // Only 2 ready players per team, but the server requires 3.
    expect(startGameMutate).not.toHaveBeenCalled();
  });

  it("does not keep retrying start_game after it has already failed", () => {
    startGameState.isError = true;
    gameState.players = [
      { id: "p1", name: "Alice", team: "red", role: "captain", isReady: true, connected: true },
      { id: "p2", name: "Bob", team: "red", role: "operative", isReady: true, connected: true },
      { id: "p3", name: "Carol", team: "blue", role: "captain", isReady: true, connected: true },
      { id: "p4", name: "Dan", team: "blue", role: "operative", isReady: true, connected: true },
    ];
    render(<LobbyPage myPlayerId="p1" />);

    expect(startGameMutate).not.toHaveBeenCalled();
  });

  it("clears a past start_game failure once the auto-start condition no longer holds", () => {
    startGameState.isError = true;
    render(<LobbyPage myPlayerId="p1" />);

    expect(startGameReset).toHaveBeenCalled();
  });

  it("hides controls and shows an observer note for spectators", () => {
    gameState.players.push({
      id: "p4",
      name: "Watcher",
      team: null,
      role: "spectator",
      isReady: false,
      connected: true,
    });
    render(<LobbyPage myPlayerId="p4" />);

    expect(screen.getByText("You are observing this mission.")).toBeInTheDocument();
  });

  it("renders nothing while game state hasn't loaded yet", () => {
    gameState = undefined as unknown as PublicGameState;
    const { container } = render(<LobbyPage myPlayerId="p1" />);

    expect(container).toBeEmptyDOMElement();
  });
});
