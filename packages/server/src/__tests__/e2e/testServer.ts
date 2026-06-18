import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "../../app.js";
import { registerSocketHandlers } from "../../socket/index.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../../socket/types.js";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const httpServer: HttpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    { cors: { origin: "*" } },
  );
  registerSocketHandlers(io);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => resolve());
      }),
  };
}
