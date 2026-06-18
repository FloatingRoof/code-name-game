import { registerRoomHandlers } from "./handlers/roomHandlers.js";
import { registerLobbyHandlers } from "./handlers/lobbyHandlers.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";
import type { AppServer } from "./context.js";

export function registerSocketHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    registerRoomHandlers(io, socket);
    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);
  });
}
