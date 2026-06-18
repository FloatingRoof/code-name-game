import type { Server, Socket } from "socket.io";
import { ServerEvent, type ErrorCode } from "@codenames/shared";
import type { Room } from "../domain/Room.js";
import { getRoom } from "../domain/store.js";
import type { Result } from "../domain/result.js";
import { toPublicState } from "../domain/serializers.js";
import type {
  AckCallback,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types.js";

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function errorAck(code: ErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
}

export function getRoomForSocket(socket: AppSocket): Room | undefined {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return undefined;
  return getRoom(roomCode);
}

/**
 * Resolves the room + playerId for an already-joined socket, or sends an
 * error ack and returns undefined. Lets handlers bail out with `if (!ctx) return;`.
 */
export function requireRoomAndPlayer<T>(
  socket: AppSocket,
  ack: AckCallback<T>,
): { room: Room; playerId: string } | undefined {
  const room = getRoomForSocket(socket);
  if (!room) {
    ack(errorAck("ROOM_NOT_FOUND", "You have not joined a room yet"));
    return undefined;
  }
  const playerId = socket.data.playerId;
  if (!playerId) {
    ack(errorAck("PLAYER_NOT_FOUND", "You have not joined a room yet"));
    return undefined;
  }
  return { room, playerId };
}

/** Applies a Room mutation result to an ack callback, broadcasting state on success. */
export function respondToMutation<T>(
  io: AppServer,
  room: Room,
  result: Result<T>,
  ack: AckCallback<T>,
): void {
  if (!result.ok) {
    ack(errorAck(result.code, result.message));
    return;
  }
  broadcastRoomState(io, room);
  ack({ ok: true, data: result.data });
}

/** Sends every connected player in the room their own per-viewer projection of state. */
export function broadcastRoomState(io: AppServer, room: Room): void {
  for (const player of room.state.players) {
    const socketId = room.playerSockets.get(player.id);
    if (!socketId) continue;
    io.to(socketId).emit(ServerEvent.GameStateUpdate, toPublicState(room.state, player.id));
  }
}
