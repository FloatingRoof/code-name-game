import {
  ClientEvent,
  ServerEvent,
  type RevealCardPayload,
  type SubmitCluePayload,
} from "@codenames/shared";
import type { AckCallback } from "../types.js";
import {
  requireRoomAndPlayer,
  respondToMutation,
  type AppServer,
  type AppSocket,
} from "../context.js";

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  socket.on(ClientEvent.SubmitClue, (payload: SubmitCluePayload, ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.submitClue(ctx.playerId, payload.word, payload.number);
    respondToMutation(io, ctx.room, result, ack);
  });

  socket.on(ClientEvent.RevealCard, (payload: RevealCardPayload, ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.revealCard(ctx.playerId, payload.cardId);
    respondToMutation(io, ctx.room, result, ack);
    const { winner, winReason } = ctx.room.state;
    if (result.ok && winner && winReason) {
      io.to(ctx.room.state.roomCode).emit(ServerEvent.GameOver, {
        winner,
        reason: winReason,
      });
    }
  });

  socket.on(ClientEvent.EndTurn, (ack: AckCallback) => {
    const ctx = requireRoomAndPlayer(socket, ack);
    if (!ctx) return;
    const result = ctx.room.endTurn(ctx.playerId);
    respondToMutation(io, ctx.room, result, ack);
  });
}
