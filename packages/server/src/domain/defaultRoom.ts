import { config } from "../config.js";
import { getOrCreateRoom } from "./store.js";
import type { Room } from "./Room.js";

/**
 * MVP holds a single active game room (no room-code entry UI yet). The store
 * itself is already keyed by roomCode (Map<roomCode, Room>), so adding
 * create/join-by-code flows later only changes how callers pick a room.
 */
export function ensureDefaultRoom(): Room {
  return getOrCreateRoom(config.defaultRoomCode);
}
