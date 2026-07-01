import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config.js";
import { deleteRoom } from "../../domain/store.js";
import { startTestServer, type TestServer } from "./testServer.js";
import { emitAck, joinAsPlayer, type TestClient } from "./testClient.js";
import { allClients, setUpReadyLobby, startGameAndWait } from "./lobbyFixture.js";

describe("forbidden / invalid actions are rejected with the right error code", () => {
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

  it("rejects start_game from an unready lobby with CANNOT_START", async () => {
    const alice = await joinAsPlayer(server.url, "Alice");
    const bob = await joinAsPlayer(server.url, "Bob");
    clients = [alice, bob];
    await emitAck(alice.socket, "select_team", { team: "red" });
    await emitAck(alice.socket, "become_captain", { team: "red" });

    const ack = await emitAck(alice.socket, "start_game");
    expect(ack.ok).toBe(false);
    if (ack.ok) throw new Error("unreachable");
    expect(ack.error?.code).toBe("CANNOT_START");
  });

  it("rejects select_team and gameplay actions from a spectator with FORBIDDEN_ROLE", async () => {
    const lobby = await setUpReadyLobby(server.url);
    const watcher = await joinAsPlayer(server.url, "Watcher", { asSpectator: true });
    clients = [...allClients(lobby), watcher];

    const teamAck = await emitAck(watcher.socket, "select_team", { team: "red" });
    expect(teamAck.ok).toBe(false);
    if (teamAck.ok) throw new Error("unreachable");
    expect(teamAck.error?.code).toBe("FORBIDDEN_ROLE");

    await startGameAndWait(lobby);

    const clueAck = await emitAck(watcher.socket, "submit_clue", { word: "X", number: 1 });
    expect(clueAck.ok).toBe(false);
    if (clueAck.ok) throw new Error("unreachable");
    expect(clueAck.error?.code).toBe("FORBIDDEN_ROLE");

    const selectAck = await emitAck(watcher.socket, "toggle_card_selection", { cardId: 0 });
    expect(selectAck.ok).toBe(false);
    if (selectAck.ok) throw new Error("unreachable");
    expect(selectAck.error?.code).toBe("FORBIDDEN_ROLE");

    const confirmGuessAck = await emitAck(watcher.socket, "confirm_guess");
    expect(confirmGuessAck.ok).toBe(false);
    if (confirmGuessAck.ok) throw new Error("unreachable");
    expect(confirmGuessAck.error?.code).toBe("FORBIDDEN_ROLE");

    const endTurnAck = await emitAck(watcher.socket, "end_turn");
    expect(endTurnAck.ok).toBe(false);
    if (endTurnAck.ok) throw new Error("unreachable");
    expect(endTurnAck.error?.code).toBe("FORBIDDEN_ROLE");

    // Spectator never receives card colors either, same as an operative.
    expect(watcher.latestState().cards.every((c) => c.revealed || c.color === null)).toBe(true);
  });

  it("rejects a clue from a non-captain and from the inactive team's captain", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);
    await startGameAndWait(lobby);

    const nonCaptainAck = await emitAck(lobby.bob.socket, "submit_clue", { word: "X", number: 1 });
    expect(nonCaptainAck.ok).toBe(false);
    if (nonCaptainAck.ok) throw new Error("unreachable");
    expect(nonCaptainAck.error?.code).toBe("NOT_CAPTAIN");

    const turn = lobby.alice.latestState().turn;
    const inactiveCaptain = turn === "red" ? lobby.cara : lobby.alice;
    const inactiveAck = await emitAck(inactiveCaptain.socket, "submit_clue", {
      word: "X",
      number: 1,
    });
    expect(inactiveAck.ok).toBe(false);
    if (inactiveAck.ok) throw new Error("unreachable");
    expect(inactiveAck.error?.code).toBe("NOT_CAPTAIN");
  });

  it("rejects toggle_card_selection with no active clue, and from the inactive team", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);
    await startGameAndWait(lobby);

    const turn = lobby.alice.latestState().turn;
    const activeOperative = turn === "red" ? lobby.bob : lobby.dee;
    const inactiveOperative = turn === "red" ? lobby.dee : lobby.bob;
    const activeCaptain = turn === "red" ? lobby.alice : lobby.cara;

    const noClueAck = await emitAck(activeOperative.socket, "toggle_card_selection", {
      cardId: 0,
    });
    expect(noClueAck.ok).toBe(false);
    if (noClueAck.ok) throw new Error("unreachable");
    expect(noClueAck.error?.code).toBe("NO_ACTIVE_CLUE");

    await emitAck(activeCaptain.socket, "submit_clue", { word: "X", number: 1 });

    const wrongTurnAck = await emitAck(inactiveOperative.socket, "toggle_card_selection", {
      cardId: 0,
    });
    expect(wrongTurnAck.ok).toBe(false);
    if (wrongTurnAck.ok) throw new Error("unreachable");
    expect(wrongTurnAck.error?.code).toBe("NOT_YOUR_TURN");
  });

  it("rejects the captain trying to select cards themselves", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);
    await startGameAndWait(lobby);

    const turn = lobby.alice.latestState().turn;
    const activeCaptain = turn === "red" ? lobby.alice : lobby.cara;
    await emitAck(activeCaptain.socket, "submit_clue", { word: "X", number: 1 });

    const ack = await emitAck(activeCaptain.socket, "toggle_card_selection", { cardId: 0 });
    expect(ack.ok).toBe(false);
    if (ack.ok) throw new Error("unreachable");
    expect(ack.error?.code).toBe("FORBIDDEN_ROLE");
  });

  it("rejects end_turn before the team has guessed, and confirm_guess with nothing selected", async () => {
    const lobby = await setUpReadyLobby(server.url);
    clients = allClients(lobby);
    await startGameAndWait(lobby);

    const turn = lobby.alice.latestState().turn;
    const activeCaptain = turn === "red" ? lobby.alice : lobby.cara;
    const activeOperative = turn === "red" ? lobby.bob : lobby.dee;
    await emitAck(activeCaptain.socket, "submit_clue", { word: "X", number: 1 });

    const confirmAck = await emitAck(activeOperative.socket, "confirm_guess");
    expect(confirmAck.ok).toBe(false);
    if (confirmAck.ok) throw new Error("unreachable");
    expect(confirmAck.error?.code).toBe("NO_CARD_SELECTED");

    const endTurnAck = await emitAck(activeOperative.socket, "end_turn");
    expect(endTurnAck.ok).toBe(false);
    if (endTurnAck.ok) throw new Error("unreachable");
    expect(endTurnAck.error?.code).toBe("MUST_GUESS_FIRST");
  });
});
