import { emitAck, joinAsPlayer, waitFor, type TestClient } from "./testClient.js";

export interface FourPlayerLobby {
  alice: TestClient; // red captain
  bob: TestClient; // red operative
  cara: TestClient; // blue captain
  dee: TestClient; // blue operative
}

/** Joins 4 players, splits them 2v2, assigns captains, and marks everyone ready (lobby phase). */
export async function setUpReadyLobby(url: string): Promise<FourPlayerLobby> {
  const alice = await joinAsPlayer(url, "Alice");
  const bob = await joinAsPlayer(url, "Bob");
  const cara = await joinAsPlayer(url, "Cara");
  const dee = await joinAsPlayer(url, "Dee");

  await emitAck(alice.socket, "select_team", { team: "red" });
  await emitAck(bob.socket, "select_team", { team: "red" });
  await emitAck(cara.socket, "select_team", { team: "blue" });
  await emitAck(dee.socket, "select_team", { team: "blue" });

  await emitAck(alice.socket, "become_captain", { team: "red" });
  await emitAck(cara.socket, "become_captain", { team: "blue" });

  for (const p of [alice, bob, cara, dee]) {
    await emitAck(p.socket, "player_ready", { ready: true });
  }

  return { alice, bob, cara, dee };
}

/** Starts the game from a ready lobby and waits for the state to reflect it. */
export async function startGameAndWait(lobby: FourPlayerLobby): Promise<void> {
  const ack = await emitAck(lobby.alice.socket, "start_game");
  if (!ack.ok) throw new Error(`start_game failed: ${JSON.stringify(ack.error)}`);
  await waitFor(() => lobby.alice.latestState()?.phase === "in_progress");
}

export function allClients(lobby: FourPlayerLobby): TestClient[] {
  return [lobby.alice, lobby.bob, lobby.cara, lobby.dee];
}
