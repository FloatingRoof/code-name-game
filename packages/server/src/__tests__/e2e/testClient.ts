import { io as ioClient, type Socket } from "socket.io-client";
import type { AckResponse, JoinGameAck, PublicGameState } from "@codenames/shared";

export interface TestClient {
  socket: Socket;
  playerId: string;
  roomCode: string;
  states: PublicGameState[];
  latestState: () => PublicGameState;
  disconnect: () => void;
}

export function emitAck<T = void>(
  socket: Socket,
  event: string,
  payload?: unknown,
): Promise<AckResponse<T>> {
  return new Promise((resolve) => {
    if (payload === undefined) {
      socket.emit(event, resolve);
    } else {
      socket.emit(event, payload, resolve);
    }
  });
}

function connect(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { transports: ["websocket"], forceNew: true });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

export async function joinAsPlayer(
  url: string,
  playerName: string,
  opts: { asSpectator?: boolean; playerId?: string; existingSocket?: Socket } = {},
): Promise<TestClient> {
  const socket = opts.existingSocket ?? (await connect(url));
  const states: PublicGameState[] = [];
  socket.on("game_state_update", (state: PublicGameState) => states.push(state));

  const ack = await emitAck<JoinGameAck>(socket, "join_game", {
    playerName,
    asSpectator: opts.asSpectator,
    playerId: opts.playerId,
  });
  if (!ack.ok || !ack.data) {
    throw new Error(`join_game failed: ${JSON.stringify(ack.error)}`);
  }

  return {
    socket,
    playerId: ack.data.playerId,
    roomCode: ack.data.roomCode,
    states,
    latestState: () => states[states.length - 1],
    disconnect: () => socket.disconnect(),
  };
}

export async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor() timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
