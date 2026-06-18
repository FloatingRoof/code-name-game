export type { AckCallback, ClientToServerEvents, ServerToClientEvents } from "@codenames/shared";

/** Per-socket connection state, separate from the room's authoritative GameState. */
export interface SocketData {
  playerId?: string;
  roomCode?: string;
}

export type InterServerEvents = Record<string, never>;
