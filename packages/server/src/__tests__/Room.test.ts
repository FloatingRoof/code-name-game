import { beforeEach, describe, expect, it } from "vitest";
import { Room } from "../domain/Room.js";

describe("Room lobby flow", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room("TEST");
  });

  it("join() creates a new player and reconnect with the same playerId restores it", () => {
    const joined = room.join({ name: "Alice" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) throw new Error("unreachable");
    const playerId = joined.data.id;

    room.markDisconnected(playerId);
    expect(room.findPlayer(playerId)?.connected).toBe(false);

    const rejoined = room.join({ name: "Alice", playerId });
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) throw new Error("unreachable");
    expect(rejoined.data.id).toBe(playerId);
    expect(rejoined.data.connected).toBe(true);
    expect(room.state.players).toHaveLength(1);
  });

  it("join() with asSpectator creates a spectator with no team", () => {
    const joined = room.join({ name: "Watcher", asSpectator: true });
    expect(joined.ok).toBe(true);
    if (!joined.ok) throw new Error("unreachable");
    expect(joined.data.role).toBe("spectator");
    expect(joined.data.team).toBeNull();
  });

  it("setTeam rejects spectators", () => {
    const joined = room.join({ name: "Watcher", asSpectator: true });
    if (!joined.ok) throw new Error("unreachable");
    const result = room.setTeam(joined.data.id, "red");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("FORBIDDEN_ROLE");
  });

  it("becomeCaptain requires being on the team first", () => {
    const joined = room.join({ name: "Bob" });
    if (!joined.ok) throw new Error("unreachable");
    const result = room.becomeCaptain(joined.data.id, "red");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("INVALID_TEAM");
  });

  it("becomeCaptain rejects taking an already-connected captain's slot", () => {
    const a = room.join({ name: "A" });
    const b = room.join({ name: "B" });
    if (!a.ok || !b.ok) throw new Error("unreachable");
    room.setTeam(a.data.id, "red");
    room.setTeam(b.data.id, "red");
    room.becomeCaptain(a.data.id, "red");

    const result = room.becomeCaptain(b.data.id, "red");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("CAPTAIN_SLOT_TAKEN");
  });

  it("becomeCaptain allows takeover when the current captain is disconnected", () => {
    const a = room.join({ name: "A" });
    const b = room.join({ name: "B" });
    if (!a.ok || !b.ok) throw new Error("unreachable");
    room.setTeam(a.data.id, "red");
    room.setTeam(b.data.id, "red");
    room.becomeCaptain(a.data.id, "red");
    room.markDisconnected(a.data.id);

    const result = room.becomeCaptain(b.data.id, "red");
    expect(result.ok).toBe(true);
    expect(room.findPlayer(a.data.id)?.role).toBe("operative");
    expect(room.findPlayer(b.data.id)?.role).toBe("captain");
  });

  it("setReady rejects spectators", () => {
    const joined = room.join({ name: "Watcher", asSpectator: true });
    if (!joined.ok) throw new Error("unreachable");
    const result = room.setReady(joined.data.id, true);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("FORBIDDEN_ROLE");
  });

  it("setTeam resets isReady so a team switch requires re-confirming readiness", () => {
    const joined = room.join({ name: "A" });
    if (!joined.ok) throw new Error("unreachable");
    room.setTeam(joined.data.id, "red");
    room.setReady(joined.data.id, true);
    expect(room.findPlayer(joined.data.id)?.isReady).toBe(true);

    room.setTeam(joined.data.id, "blue");
    expect(room.findPlayer(joined.data.id)?.isReady).toBe(false);
  });

  it("becomeCaptain resets isReady so the new captain must re-confirm readiness", () => {
    const joined = room.join({ name: "A" });
    if (!joined.ok) throw new Error("unreachable");
    room.setTeam(joined.data.id, "red");
    room.setReady(joined.data.id, true);
    room.becomeCaptain(joined.data.id, "red");
    expect(room.findPlayer(joined.data.id)?.isReady).toBe(false);
  });

  it("canStart reports MIN_PLAYERS when a team is short", () => {
    const a = room.join({ name: "A" });
    if (!a.ok) throw new Error("unreachable");
    room.setTeam(a.data.id, "red");
    expect(room.canStart()).toEqual({ ok: false, reason: "MIN_PLAYERS" });
  });

  function fillValidLobby(r: Room) {
    const players = ["A", "B", "C", "D"].map((name) => {
      const joined = r.join({ name });
      if (!joined.ok) throw new Error("unreachable");
      return joined.data;
    });
    r.setTeam(players[0].id, "red");
    r.setTeam(players[1].id, "red");
    r.setTeam(players[2].id, "blue");
    r.setTeam(players[3].id, "blue");
    r.becomeCaptain(players[0].id, "red");
    r.becomeCaptain(players[2].id, "blue");
    for (const p of players) r.setReady(p.id, true);
    return players;
  }

  it("canStart passes once both teams have a captain, min players, and are ready", () => {
    fillValidLobby(room);
    expect(room.canStart()).toEqual({ ok: true });
  });

  it("startGame builds a 25-card deck and moves phase to in_progress", () => {
    fillValidLobby(room);
    const result = room.startGame();
    expect(result.ok).toBe(true);
    expect(room.state.phase).toBe("in_progress");
    expect(room.state.cards).toHaveLength(25);
    expect(room.state.teams.red.remaining + room.state.teams.blue.remaining).toBe(17);
  });

  it("startGame fails if canStart() fails", () => {
    const result = room.startGame();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("CANNOT_START");
  });
});

describe("Room gameplay flow", () => {
  let room: Room;
  let red1: string, blue1: string;

  beforeEach(() => {
    room = new Room("TEST");
    const players = ["Red1", "Red2", "Blue1", "Blue2"].map((name) => {
      const joined = room.join({ name });
      if (!joined.ok) throw new Error("unreachable");
      return joined.data;
    });
    room.setTeam(players[0].id, "red");
    room.setTeam(players[1].id, "red");
    room.setTeam(players[2].id, "blue");
    room.setTeam(players[3].id, "blue");
    room.becomeCaptain(players[0].id, "red");
    room.becomeCaptain(players[2].id, "blue");
    for (const p of players) room.setReady(p.id, true);
    room.startGame();
    red1 = players[0].id; // red captain
    blue1 = players[2].id; // blue captain
  });

  it("rejects a clue from a non-captain", () => {
    const redOperative = room.state.players.find(
      (p) => p.team === "red" && p.role === "operative",
    )!.id;
    const result = room.submitClue(redOperative, "FRUIT", 2);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NOT_CAPTAIN");
  });

  it("rejects a clue from the inactive team's captain", () => {
    const activeCaptainId = room.state.turn === "red" ? blue1 : red1;
    const result = room.submitClue(activeCaptainId, "FRUIT", 2);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NOT_CAPTAIN");
  });

  it("accepts a valid clue from the active captain and rejects a second one", () => {
    const activeCaptainId = room.state.turn === "red" ? red1 : blue1;
    const first = room.submitClue(activeCaptainId, "FRUIT", 2);
    expect(first.ok).toBe(true);
    expect(room.state.currentClue?.guessesRemaining).toBe(3);

    const second = room.submitClue(activeCaptainId, "ANIMAL", 1);
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.code).toBe("CLUE_ALREADY_ACTIVE");
  });

  it("rejects reveal_card with no active clue", () => {
    const activeOperative = room.state.players.find(
      (p) => p.team === room.state.turn && p.role === "operative",
    )!.id;
    const result = room.revealCard(activeOperative, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NO_ACTIVE_CLUE");
  });

  it("rejects reveal_card from the inactive team", () => {
    const activeCaptainId = room.state.turn === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const inactiveOperative = room.state.players.find(
      (p) => p.team !== room.state.turn && p.role === "operative",
    )!.id;
    const result = room.revealCard(inactiveOperative, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NOT_YOUR_TURN");
  });

  it("full turn: own-color guess keeps the turn, opponent-color guess switches it", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 3);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;

    const ownCard = room.state.cards.find((c) => c.color === activeTeam)!;
    const beforeRemaining = room.state.teams[activeTeam].remaining;
    const guess1 = room.revealCard(activeOperative, ownCard.id);
    expect(guess1.ok).toBe(true);
    expect(room.state.turn).toBe(activeTeam); // still our turn
    expect(room.state.teams[activeTeam].remaining).toBe(beforeRemaining - 1);

    const otherColorCard = room.state.cards.find(
      (c) => !c.revealed && c.color !== activeTeam && c.color !== "assassin",
    )!;
    const guess2 = room.revealCard(activeOperative, otherColorCard.id);
    expect(guess2.ok).toBe(true);
    expect(room.state.turn).not.toBe(activeTeam); // turn switched
    expect(room.state.currentClue).toBeNull();
  });

  it("rejects spectator gameplay actions with FORBIDDEN_ROLE", () => {
    const spec = room.join({ name: "Watcher", asSpectator: true });
    if (!spec.ok) throw new Error("unreachable");
    const activeCaptainId = room.state.turn === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);

    const revealResult = room.revealCard(spec.data.id, 0);
    expect(revealResult.ok).toBe(false);
    if (revealResult.ok) throw new Error("unreachable");
    expect(revealResult.code).toBe("FORBIDDEN_ROLE");

    const clueResult = room.submitClue(spec.data.id, "X", 1);
    expect(clueResult.ok).toBe(false);
    if (clueResult.ok) throw new Error("unreachable");
    expect(clueResult.code).toBe("FORBIDDEN_ROLE");
  });

  it("ends the game when the assassin card is revealed", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "DANGER", 1);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const assassinCard = room.state.cards.find((c) => c.color === "assassin")!;

    const result = room.revealCard(activeOperative, assassinCard.id);
    expect(result.ok).toBe(true);
    expect(room.state.phase).toBe("finished");
    expect(room.state.winReason).toBe("assassin_revealed");
    expect(room.state.winner).not.toBe(activeTeam);
  });
});
