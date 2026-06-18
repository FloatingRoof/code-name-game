import type { PublicGameState, TeamColor } from "./types.js";

/** Client -> server event names. */
export const ClientEvent = {
  JoinGame: "join_game",
  SelectTeam: "select_team",
  BecomeCaptain: "become_captain",
  PlayerReady: "player_ready",
  StartGame: "start_game",
  SubmitClue: "submit_clue",
  RevealCard: "reveal_card",
  EndTurn: "end_turn",
  LeaveGame: "leave_game",
  RequestState: "request_state",
} as const;

/** Server -> client event names. */
export const ServerEvent = {
  GameStateUpdate: "game_state_update",
  Error: "error",
  PlayerJoined: "player_joined",
  PlayerLeft: "player_left",
  GameOver: "game_over",
} as const;

export interface JoinGamePayload {
  playerName: string;
  playerId?: string;
  asSpectator?: boolean;
  roomCode?: string;
}

export interface JoinGameAck {
  playerId: string;
  roomCode: string;
}

export interface SelectTeamPayload {
  team: TeamColor;
}

export interface BecomeCaptainPayload {
  team: TeamColor;
}

export interface PlayerReadyPayload {
  ready: boolean;
}

export interface SubmitCluePayload {
  word: string;
  number: number;
}

export interface RevealCardPayload {
  cardId: number;
}

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "INVALID_NAME"
  | "NAME_TAKEN"
  | "FORBIDDEN_ROLE"
  | "NOT_YOUR_TURN"
  | "NOT_CAPTAIN"
  | "CLUE_ALREADY_ACTIVE"
  | "NO_ACTIVE_CLUE"
  | "INVALID_CLUE"
  | "CARD_ALREADY_REVEALED"
  | "CARD_NOT_FOUND"
  | "CAPTAIN_SLOT_TAKEN"
  | "CANNOT_START"
  | "GAME_ALREADY_FINISHED"
  | "INVALID_TEAM";

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  name: string;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface GameOverPayload {
  winner: TeamColor;
  reason: "all_words_found" | "assassin_revealed";
}

export type GameStateUpdatePayload = PublicGameState;

export interface AckResponse<T> {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
}

export type AckCallback<T = void> = (response: AckResponse<T>) => void;

/** Socket.IO typed event map, shared by both the server (`Server<...>`) and the client (`Socket<...>`). */
export interface ClientToServerEvents {
  join_game: (payload: JoinGamePayload, ack: AckCallback<JoinGameAck>) => void;
  select_team: (payload: SelectTeamPayload, ack: AckCallback) => void;
  become_captain: (payload: BecomeCaptainPayload, ack: AckCallback) => void;
  player_ready: (payload: PlayerReadyPayload, ack: AckCallback) => void;
  start_game: (ack: AckCallback) => void;
  submit_clue: (payload: SubmitCluePayload, ack: AckCallback) => void;
  reveal_card: (payload: RevealCardPayload, ack: AckCallback) => void;
  end_turn: (ack: AckCallback) => void;
  leave_game: (ack: AckCallback) => void;
  request_state: (ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  game_state_update: (payload: GameStateUpdatePayload) => void;
  error: (payload: ErrorPayload) => void;
  player_joined: (payload: PlayerJoinedPayload) => void;
  player_left: (payload: PlayerLeftPayload) => void;
  game_over: (payload: GameOverPayload) => void;
}
