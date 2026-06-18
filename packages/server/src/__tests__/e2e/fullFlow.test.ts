import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config.js";
import { deleteRoom } from "../../domain/store.js";
import { startTestServer, type TestServer } from "./testServer.js";
import { emitAck, joinAsPlayer, waitFor, type TestClient } from "./testClient.js";
import {
  allClients,
  setUpReadyLobby,
  startGameAndWait,
  type FourPlayerLobby,
} from "./lobbyFixture.js";

describe("full game flow: 2v2 + spectator, win by finding all words", () => {
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

  it("runs lobby -> game -> win, with correct per-role visibility throughout", async () => {
    const lobby: FourPlayerLobby = await setUpReadyLobby(server.url);
    const watcher = await joinAsPlayer(server.url, "Watcher", { asSpectator: true });
    clients = [...allClients(lobby), watcher];

    await startGameAndWait(lobby);
    await waitFor(() => watcher.latestState()?.phase === "in_progress");

    // Visibility: captain sees all colors, operative/spectator only revealed ones (none yet).
    const aliceState = lobby.alice.latestState();
    const bobState = lobby.bob.latestState();
    const watcherState = watcher.latestState();
    expect(aliceState.viewerRole).toBe("captain");
    expect(aliceState.cards.every((c) => c.color !== null)).toBe(true);
    expect(bobState.viewerRole).toBe("operative");
    expect(bobState.cards.every((c) => c.revealed || c.color === null)).toBe(true);
    expect(watcherState.viewerRole).toBe("spectator");
    expect(watcherState.cards.every((c) => c.revealed || c.color === null)).toBe(true);

    const startingTeam = aliceState.turn;
    const activeCaptain = startingTeam === "red" ? lobby.alice : lobby.cara;
    const activeOperative = startingTeam === "red" ? lobby.bob : lobby.dee;

    // Reveal every own-color card for the active team, one clue per card to keep this simple.
    const ownCards = aliceState.cards.filter((c) => c.color === startingTeam);
    expect(ownCards).toHaveLength(9); // starting team always gets 9 in the standard distribution

    for (const card of ownCards) {
      const clueAck = await emitAck(activeCaptain.socket, "submit_clue", {
        word: "WORD",
        number: 1,
      });
      expect(clueAck.ok).toBe(true);
      const revealAck = await emitAck(activeOperative.socket, "reveal_card", { cardId: card.id });
      expect(revealAck.ok).toBe(true);
      await emitAck(activeOperative.socket, "end_turn");
      // captain submits a fresh clue again immediately since revealCard ends the turn after 1 guess;
      // re-fetch latest state to check if the game already ended.
      await waitFor(() => activeCaptain.latestState() !== undefined);
      if (activeCaptain.latestState().winner) break;
      // it's the other team's turn now (since we ended turn) -- pass it back for the next clue
      const otherCaptain = activeCaptain === lobby.alice ? lobby.cara : lobby.alice;
      const otherOperative = activeCaptain === lobby.alice ? lobby.dee : lobby.bob;
      await emitAck(otherCaptain.socket, "submit_clue", { word: "PASS", number: 0 });
      await emitAck(otherOperative.socket, "end_turn");
    }

    await waitFor(() => Boolean(lobby.alice.latestState().winner), 4000);
    const finalState = lobby.alice.latestState();
    expect(finalState.winner).toBe(startingTeam);
    expect(finalState.winReason).toBe("all_words_found");
    expect(finalState.phase).toBe("finished");

    // Once finished, even operatives/spectators see the full board.
    await waitFor(() => watcher.latestState().phase === "finished");
    expect(watcher.latestState().cards.every((c) => c.color !== null)).toBe(true);
    expect(lobby.bob.latestState().cards.every((c) => c.color !== null)).toBe(true);
  });
});
