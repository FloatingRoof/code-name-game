import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config.js";
import { deleteRoom } from "../../domain/store.js";
import { startTestServer, type TestServer } from "./testServer.js";
import { emitAck, waitFor, type TestClient } from "./testClient.js";
import { allClients, setUpReadyLobby, startGameAndWait } from "./lobbyFixture.js";

describe("assassin card ends the game immediately", () => {
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

  it("the revealing team instantly loses when they hit the assassin card", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);
    await startGameAndWait(lobby);

    const startingTeam = lobby.alice.latestState().turn;
    const activeCaptain = startingTeam === "red" ? lobby.alice : lobby.cara;
    const activeOperative = startingTeam === "red" ? lobby.bob : lobby.dee;

    const assassinCard = lobby.alice.latestState().cards.find((c) => c.color === "assassin");
    expect(assassinCard).toBeDefined();

    const clueAck = await emitAck(activeCaptain.socket, "submit_clue", {
      word: "DANGER",
      number: 1,
    });
    expect(clueAck.ok).toBe(true);

    const revealAck = await emitAck(activeOperative.socket, "reveal_card", {
      cardId: assassinCard!.id,
    });
    expect(revealAck.ok).toBe(true);

    await waitFor(() => lobby.cara.latestState()?.phase === "finished");
    const finalState = lobby.alice.latestState();
    expect(finalState.winReason).toBe("assassin_revealed");
    expect(finalState.winner).not.toBe(startingTeam);
    expect(finalState.phase).toBe("finished");

    // Full board is revealed to everyone once the game is finished.
    expect(lobby.bob.latestState().cards.every((c) => c.color !== null)).toBe(true);
  });
});
