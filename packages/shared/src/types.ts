export type TeamColor = "red" | "blue";
export type CardColor = TeamColor | "neutral" | "assassin";
export type PlayerRole = "captain" | "operative" | "spectator";
export type GamePhase = "lobby" | "in_progress" | "finished";
export type WinReason = "all_words_found" | "assassin_revealed" | null;

export interface Player {
  id: string;
  name: string;
  team: TeamColor | null;
  role: PlayerRole;
  isReady: boolean;
  connected: boolean;
}

export interface Card {
  id: number;
  word: string;
  color: CardColor;
  revealed: boolean;
}

export interface Clue {
  word: string;
  number: number;
  byPlayerId: string;
  guessesRemaining: number;
}

export interface TeamState {
  color: TeamColor;
  remaining: number;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  cards: Card[];
  turn: TeamColor;
  currentClue: Clue | null;
  teams: Record<TeamColor, TeamState>;
  winner: TeamColor | null;
  winReason: WinReason;
  createdAt: number;
  lastActivityAt: number;
}

/** Card as seen by a specific viewer: color is null unless revealed or the viewer is a captain. */
export interface PublicCard {
  id: number;
  word: string;
  revealed: boolean;
  color: CardColor | null;
}

/** Per-viewer projection of GameState. Never includes hidden card colors for operative/spectator viewers. */
export interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  cards: PublicCard[];
  turn: TeamColor;
  currentClue: Clue | null;
  teams: Record<TeamColor, TeamState>;
  winner: TeamColor | null;
  winReason: WinReason;
  viewerRole: PlayerRole;
}
