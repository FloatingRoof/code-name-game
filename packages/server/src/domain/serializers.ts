import type { GameState, PublicCard, PublicGameState } from "@codenames/shared";

/**
 * Per-viewer projection of GameState. Card colors for unrevealed cards are only
 * included for the captain of the room (or once the game is finished). This is
 * the single point that must always sit between raw GameState and any socket
 * payload — never serialize `state.cards` directly onto the wire.
 */
export function toPublicState(state: GameState, viewerPlayerId: string): PublicGameState {
  const viewer = state.players.find((p) => p.id === viewerPlayerId);
  const viewerRole = viewer?.role ?? "spectator";
  const revealAllColors = state.phase === "finished" || viewerRole === "captain";

  const cards: PublicCard[] = state.cards.map((card) => ({
    id: card.id,
    word: card.word,
    revealed: card.revealed,
    color: card.revealed || revealAllColors ? card.color : null,
  }));

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    players: state.players,
    cards,
    turn: state.turn,
    currentClue: state.currentClue,
    teams: state.teams,
    winner: state.winner,
    winReason: state.winReason,
    viewerRole,
  };
}
