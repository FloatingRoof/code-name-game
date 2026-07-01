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

    // Reveal every own-color card for the active team. A correct guess never ends the
    // turn, so one generous clue is enough to confirm all of them in a single turn.
    const ownCards = aliceState.cards.filter((c) => c.color === startingTeam);
    expect(ownCards).toHaveLength(9); // starting team always gets 9 in the standard distribution

    const clueAck = await emitAck(activeCaptain.socket, "submit_clue", {
      word: "WORD",
      number: ownCards.length - 1, // +1 rule grants exactly ownCards.length guesses
    });
    expect(clueAck.ok).toBe(true);

    for (const card of ownCards) {
      const selectAck = await emitAck(activeOperative.socket, "toggle_card_selection", {
        cardId: card.id,
      });
      expect(selectAck.ok).toBe(true);
      const confirmAck = await emitAck(activeOperative.socket, "confirm_guess");
      expect(confirmAck.ok).toBe(true);
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
