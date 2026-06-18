import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { registerSocketHandlers } from "./socket/index.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket/types.js";

const app = createApp();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  { cors: { origin: config.clientOrigin, credentials: true } },
);

registerSocketHandlers(io);

httpServer.listen(config.port, () => {
  console.log(`codenames server listening on :${config.port}`);
});
