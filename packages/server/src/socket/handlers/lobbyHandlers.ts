import {
  ClientEvent,
  type BecomeCaptainPayload,
  type PlayerReadyPayload,
  type SelectTeamPayload,
} from "@codenames/shared";
import type { AckCallback } from "../types.js";
import {
  requireRoomAndPlayer,
  respondToMutation,
  type AppServer,
  type AppSocket,
} from "../context.js";

export function registerLobbyHandlers(io: AppServer, socket: AppSocket): void {
  socket.on(ClientEvent.SelectTeam, (payload: SelectTeamPayload, ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.setTeam(ctx.playerId, payload.team);
    respondToMutation(io, ctx.room, result, ack);
  });

  socket.on(ClientEvent.BecomeCaptain, (payload: BecomeCaptainPayload, ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.becomeCaptain(ctx.playerId, payload.team);
    respondToMutation(io, ctx.room, result, ack);
  });

  socket.on(ClientEvent.PlayerReady, (payload: PlayerReadyPayload, ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.setReady(ctx.playerId, payload.ready);
    respondToMutation(io, ctx.room, result, ack);
  });

  socket.on(ClientEvent.StartGame, (ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.startGame();
    respondToMutation(io, ctx.room, result, ack);
  });
}
