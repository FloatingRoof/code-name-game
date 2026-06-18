import {
  ClientEvent,
  ServerEvent,
  type JoinGameAck,
  type JoinGamePayload,
} from "@codenames/shared";
import { ensureDefaultRoom } from "../../domain/defaultRoom.js";
import type { AckCallback } from "../types.js";
import {
  broadcastRoomState,
  errorAck,
  getRoomForSocket,
  requireRoomAndPlayer,
  type AppServer,
  type AppSocket,
} from "../context.js";

export function registerRoomHandlers(io: AppServer, socket: AppSocket): void {
  socket.on(ClientEvent.JoinGame, (payload: JoinGamePayload, ack: AckCallback<JoinGameAck>) => {
    const name = payload.playerName?.trim();
    if (!name) {
      ack(errorAck("INVALID_NAME", "Player name is required"));
      return;
    }

    const room = ensureDefaultRoom();
    const result = room.join({
      playerId: payload.playerId,
      name,
      asSpectator: payload.asSpectator,
    });
    if (!result.ok) {
      ack(errorAck(result.code, result.message));
      return;
    }

    const player = result.data;
    socket.data.playerId = player.id;
    socket.data.roomCode = room.state.roomCode;
    room.playerSockets.set(player.id, socket.id);
    void socket.join(room.state.roomCode);

    socket
      .to(room.state.roomCode)
      .emit(ServerEvent.PlayerJoined, { playerId: player.id, name: player.name });
    broadcastRoomState(io, room);
    ack({ ok: true, data: { playerId: player.id, roomCode: room.state.roomCode } });
  });

  socket.on(ClientEvent.RequestState, (ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    // The player may be re-requesting state on a fresh socket (e.g. after a refresh).
    ctx.room.playerSockets.set(ctx.playerId, socket.id);
    broadcastRoomState(io, ctx.room);
    ack({ ok: true });
  });

  socket.on(ClientEvent.LeaveGame, (ack: AckCallback) => {
    const room = getRoomForSocket(socket);
    const playerId = socket.data.playerId;
    if (room && playerId) {
      room.disconnectSocket(playerId, socket.id);
      socket.to(room.state.roomCode).emit(ServerEvent.PlayerLeft, { playerId });
      broadcastRoomState(io, room);
      void socket.leave(room.state.roomCode);
    }
    socket.data.playerId = undefined;
    socket.data.roomCode = undefined;
    ack({ ok: true });
  });

  socket.on("disconnect", () => {
    const room = getRoomForSocket(socket);
    const playerId = socket.data.playerId;
    if (room && playerId) {
      room.disconnectSocket(playerId, socket.id);
      broadcastRoomState(io, room);
    }
  });
}
