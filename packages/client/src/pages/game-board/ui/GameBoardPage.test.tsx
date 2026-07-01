import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameState } from "@codenames/shared";
import { GameBoardPage } from "./GameBoardPage";

function mockMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia,
  );
}

const submitClueMutate = vi.fn();
const toggleCardSelectionMutate = vi.fn();
const confirmGuessMutate = vi.fn();
const endTurnMutate = vi.fn();

const submitClueState = {
  mutate: submitClueMutate,
  isPending: false,
  error: null as Error | null,
};
const toggleCardSelectionState = {
  mutate: toggleCardSelectionMutate,
  isPending: false,
  error: null as Error | null,
};
const confirmGuessState = {
  mutate: confirmGuessMutate,
  isPending: false,
  error: null as Error | null,
};
const endTurnState = {
  mutate: endTurnMutate,
  isPending: false,
  error: null as Error | null,
};

let gameState: PublicGameState;

vi.mock("../api/use-submit-clue", () => ({
  useSubmitClue: () => submitClueState,
}));
vi.mock("../api/use-toggle-card-selection", () => ({
  useToggleCardSelection: () => toggleCardSelectionState,
}));
vi.mock("../api/use-confirm-guess", () => ({
  useConfirmGuess: () => confirmGuessState,
}));
vi.mock("../api/use-end-turn", () => ({
  useEndTurn: () => endTurnState,
}));
vi.mock("../../../shared/socket", () => ({
  useGameState: () => ({ data: gameState }),
}));

function buildGameState(): PublicGameState {
  return {
    roomCode: "MAIN",
    phase: "in_progress",
    players: [
      { id: "p1", name: "Alice", team: "red", role: "captain", isReady: true, connected: true },
      {
        id: "p2",
        name: "Bob",
        team: "red",
        role: "operative",
        isReady: true,
        connected: true,
      },
      {
        id: "p3",
        name: "Carol",
        team: "blue",
        role: "captain",
        isReady: true,
        connected: true,
      },
    ],
    cards: [
      { id: 0, word: "OCEAN", revealed: false, color: "red" },
      { id: 1, word: "ROCKET", revealed: true, color: "blue" },
    ],
    turn: "red",
    currentClue: null,
    selectedCardIds: [],
    teams: {
      red: { color: "red", remaining: 9 },
      blue: { color: "blue", remaining: 7 },
    },
    winner: null,
    winReason: null,
    viewerRole: "captain",
    minPlayersPerTeam: 2,
  };
}

describe("GameBoardPage", () => {
  beforeEach(() => {
    mockMatchMedia();
    submitClueMutate.mockClear();
    toggleCardSelectionMutate.mockClear();
    confirmGuessMutate.mockClear();
    endTurnMutate.mockClear();
    submitClueState.isPending = false;
    submitClueState.error = null;
    toggleCardSelectionState.isPending = false;
    toggleCardSelectionState.error = null;
    confirmGuessState.isPending = false;
    confirmGuessState.error = null;
    endTurnState.isPending = false;
    endTurnState.error = null;
    gameState = buildGameState();
  });

  it("renders the board and team scores", () => {
    render(<GameBoardPage myPlayerId="p1" />);

    expect(screen.getByText("OCEAN")).toBeInTheDocument();
    expect(screen.getByText("ROCKET")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("lets the active captain submit a clue", async () => {
    const user = userEvent.setup();
    render(<GameBoardPage myPlayerId="p1" />);

    await user.type(screen.getByPlaceholderText("Clue word"), "WATER");
    await user.click(screen.getByRole("button", { name: "Submit clue" }));

    expect(submitClueMutate).toHaveBeenCalledWith({ word: "WATER", number: 1 }, expect.anything());
  });

  it("does not show a clue form for a non-captain", () => {
    render(<GameBoardPage myPlayerId="p2" />);

    expect(screen.queryByPlaceholderText("Clue word")).not.toBeInTheDocument();
  });

  it("toggles a card's shared selection without revealing it", async () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    const user = userEvent.setup();
    render(<GameBoardPage myPlayerId="p2" />);

    await user.click(screen.getByRole("button", { name: "OCEAN" }));
    expect(toggleCardSelectionMutate).toHaveBeenCalledWith({ cardId: 0 });
    expect(confirmGuessMutate).not.toHaveBeenCalled();
  });

  it("shows selected cards (from server state) to everyone on the team, not just whoever clicked", () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    gameState.selectedCardIds = [0];
    render(<GameBoardPage myPlayerId="p2" />);

    expect(screen.getByRole("button", { name: "OCEAN" })).toHaveClass("game-board__card--selected");
  });

  it("disables already-revealed cards", () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    render(<GameBoardPage myPlayerId="p2" />);

    expect(screen.getByRole("button", { name: "ROCKET" })).toBeDisabled();
  });

  it("shows a disabled confirm button until a card is picked", () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    render(<GameBoardPage myPlayerId="p2" />);

    expect(screen.queryByRole("button", { name: "Confirm guess" })).not.toBeInTheDocument();
  });

  it("confirms the selected card", async () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    gameState.selectedCardIds = [0];
    const user = userEvent.setup();
    render(<GameBoardPage myPlayerId="p2" />);

    await user.click(screen.getByRole("button", { name: "Confirm guess" }));
    expect(confirmGuessMutate).toHaveBeenCalled();
  });

  it("disables the end turn button until the team has guessed at least once", () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 0,
    };
    render(<GameBoardPage myPlayerId="p2" />);

    expect(screen.getByRole("button", { name: "End turn" })).toBeDisabled();
  });

  it("enables the end turn button once the team has guessed at least once", async () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 1,
      guessesUsed: 1,
    };
    const user = userEvent.setup();
    render(<GameBoardPage myPlayerId="p2" />);

    const button = screen.getByRole("button", { name: "End turn" });
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(endTurnMutate).toHaveBeenCalled();
  });

  it("never shows guess controls to the captain, even on the active team", () => {
    gameState.currentClue = {
      word: "WATER",
      number: 1,
      byPlayerId: "p1",
      guessesRemaining: 2,
      guessesUsed: 1,
    };
    render(<GameBoardPage myPlayerId="p1" />);

    expect(screen.queryByRole("button", { name: "End turn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm guess" })).not.toBeInTheDocument();
  });

  it("hides board controls for the inactive team", () => {
    render(<GameBoardPage myPlayerId="p3" />);

    expect(screen.queryByPlaceholderText("Clue word")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End turn" })).not.toBeInTheDocument();
  });

  it("shows a winner banner once the game is finished", () => {
    gameState.phase = "finished";
    gameState.winner = "red";
    gameState.winReason = "all_words_found";
    render(<GameBoardPage myPlayerId="p1" />);

    expect(screen.getByText(/Red team wins/)).toBeInTheDocument();
  });

  it("renders nothing while game state hasn't loaded yet", () => {
    gameState = undefined as unknown as PublicGameState;
    const { container } = render(<GameBoardPage myPlayerId="p1" />);

    expect(container).toBeEmptyDOMElement();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
