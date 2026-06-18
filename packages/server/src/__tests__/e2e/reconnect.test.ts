import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config.js";
import { deleteRoom } from "../../domain/store.js";
import { startTestServer, type TestServer } from "./testServer.js";
import { emitAck, joinAsPlayer, waitFor, type TestClient } from "./testClient.js";
import { allClients, setUpReadyLobby } from "./lobbyFixture.js";

describe("disconnect / reconnect", () => {
  let server: TestServer;
  let clients: TestClient[] = [];

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    deleteRoom(config.defaultRoomCode);
    clients = [];
  });

  afterEach(() => {
    for (const c of clients) c.disconnect();
  });

  it("marks a player disconnected without removing them, then restores state on reconnect", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);

    lobby.alice.socket.disconnect();
    await waitFor(() => {
      const alice = lobby.bob.latestState().players.find((p) => p.id === lobby.alice.playerId);
      return alice?.connected === false;
    });

    const beforeReconnect = lobby.bob.latestState();
    expect(beforeReconnect.players).toHaveLength(4); // disconnected player is not removed

    const aliceAgain = await joinAsPlayer(server.url, "Alice", { playerId: lobby.alice.playerId });
    clients.push(aliceAgain);

    expect(aliceAgain.playerId).toBe(lobby.alice.playerId);
    await waitFor(() => {
      const alice = lobby.bob.latestState().players.find((p) => p.id === lobby.alice.playerId);
      return alice?.connected === true;
    });

    const reconnectedAlice = aliceAgain
      .latestState()
      .players.find((p) => p.id === lobby.alice.playerId);
    expect(reconnectedAlice?.team).toBe("red");
    expect(reconnectedAlice?.role).toBe("captain");
  });

  it("allows a teammate to take over an abandoned captain slot, then reconnecting demotes the original captain", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);

    lobby.alice.socket.disconnect();
    await waitFor(() => {
      const alice = lobby.bob.latestState().players.find((p) => p.id === lobby.alice.playerId);
      return alice?.connected === false;
    });

    const takeoverAck = await emitAck(lobby.bob.socket, "become_captain", { team: "red" });
    expect(takeoverAck.ok).toBe(true);
    await waitFor(() => {
      const bob = lobby.bob.latestState().players.find((p) => p.id === lobby.bob.playerId);
      return bob?.role === "captain";
    });

    const aliceAgain = await joinAsPlayer(server.url, "Alice", { playerId: lobby.alice.playerId });
    clients.push(aliceAgain);

    const finalState = aliceAgain.latestState();
    const alicePlayer = finalState.players.find((p) => p.id === lobby.alice.playerId);
    const bobPlayer = finalState.players.find((p) => p.id === lobby.bob.playerId);
    expect(alicePlayer?.role).toBe("operative");
    expect(bobPlayer?.role).toBe("captain");
  });
});
