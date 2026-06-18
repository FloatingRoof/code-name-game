import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@codenames/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export const socket: AppSocket = io(SERVER_URL, { autoConnect: false });
