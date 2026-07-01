import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("join() rejects a name that is already taken by another player", () => {
    const first = room.join({ name: "Alice" });
    expect(first.ok).toBe(true);

    const second = room.join({ name: "Alice" });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.code).toBe("NAME_TAKEN");
    expect(room.state.players).toHaveLength(1);
  });

  it("join() rejects a name that is already taken, case-insensitively", () => {
    const first = room.join({ name: "Alice" });
    expect(first.ok).toBe(true);

    const second = room.join({ name: "ALICE" });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.code).toBe("NAME_TAKEN");
  });

  it("join() allows reusing a name after the original player reconnects with their playerId", () => {
    const first = room.join({ name: "Alice" });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");

    const rejoined = room.join({ name: "Alice", playerId: first.data.id });
    expect(rejoined.ok).toBe(true);
    expect(room.state.players).toHaveLength(1);
  });

  it("join() rejects a reconnecting player renaming themselves to another player's name", () => {
    const first = room.join({ name: "Alice" });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    const second = room.join({ name: "Bob" });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");

    const renamed = room.join({ name: "Bob", playerId: first.data.id });
    expect(renamed.ok).toBe(false);
    if (renamed.ok) throw new Error("unreachable");
    expect(renamed.code).toBe("NAME_TAKEN");
    expect(room.findPlayer(first.data.id)?.name).toBe("Alice");
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

  it("rejects toggleCardSelection with no active clue", () => {
    const activeOperative = room.state.players.find(
      (p) => p.team === room.state.turn && p.role === "operative",
    )!.id;
    const result = room.toggleCardSelection(activeOperative, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NO_ACTIVE_CLUE");
  });

  it("rejects toggleCardSelection from the inactive team", () => {
    const activeCaptainId = room.state.turn === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const inactiveOperative = room.state.players.find(
      (p) => p.team !== room.state.turn && p.role === "operative",
    )!.id;
    const result = room.toggleCardSelection(inactiveOperative, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NOT_YOUR_TURN");
  });

  it("toggleCardSelection selects then deselects a single card", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;

    room.toggleCardSelection(activeOperative, 0);
    expect(room.state.selectedCardIds).toEqual([0]);

    room.toggleCardSelection(activeOperative, 0);
    expect(room.state.selectedCardIds).toEqual([]);
  });

  it("toggleCardSelection picking a different card replaces the previous selection", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;

    room.toggleCardSelection(activeOperative, 0);
    room.toggleCardSelection(activeOperative, 1);
    expect(room.state.selectedCardIds).toEqual([1]);
  });

  it("rejects a captain calling endTurn", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);

    const result = room.endTurn(activeCaptainId);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("FORBIDDEN_ROLE");
  });

  it("rejects a captain toggling card selection", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);

    const result = room.toggleCardSelection(activeCaptainId, 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("FORBIDDEN_ROLE");
  });

  it("rejects confirmGuess with no card selected", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;

    const result = room.confirmGuess(activeOperative);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("NO_CARD_SELECTED");
  });

  it("rejects endTurn before the team has guessed at least once", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;

    const result = room.endTurn(activeOperative);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("MUST_GUESS_FIRST");
    expect(room.state.turn).toBe(activeTeam);
  });

  it("confirmGuess reveals an own-color pick and lets the team keep guessing", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 3); // allows 4 guesses
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const ownCard = room.state.cards.find((c) => c.color === activeTeam)!;
    const beforeRemaining = room.state.teams[activeTeam].remaining;

    room.toggleCardSelection(activeOperative, ownCard.id);
    const result = room.confirmGuess(activeOperative);

    expect(result.ok).toBe(true);
    expect(room.state.cards.find((c) => c.id === ownCard.id)?.revealed).toBe(true);
    expect(room.state.teams[activeTeam].remaining).toBe(beforeRemaining - 1);
    expect(room.state.turn).toBe(activeTeam); // still the same team's turn
    expect(room.state.currentClue?.guessesRemaining).toBe(3);
    expect(room.state.currentClue?.guessesUsed).toBe(1);
    expect(room.state.selectedCardIds).toEqual([]);
  });

  it("a wrong guess ends the turn immediately, even on the first guess", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const otherColorCard = room.state.cards.find(
      (c) => !c.revealed && c.color !== activeTeam && c.color !== "assassin",
    )!;

    room.toggleCardSelection(activeOperative, otherColorCard.id);
    const result = room.confirmGuess(activeOperative);

    expect(result.ok).toBe(true);
    expect(room.state.cards.find((c) => c.id === otherColorCard.id)?.revealed).toBe(true);
    expect(room.state.turn).not.toBe(activeTeam);
    expect(room.state.currentClue).toBeNull();
  });

  it("the team may stop after one correct guess and explicitly pass the turn", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 3);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const ownCard = room.state.cards.find((c) => c.color === activeTeam)!;

    room.toggleCardSelection(activeOperative, ownCard.id);
    room.confirmGuess(activeOperative);

    const result = room.endTurn(activeOperative);
    expect(result.ok).toBe(true);
    expect(room.state.turn).not.toBe(activeTeam);
    expect(room.state.currentClue).toBeNull();
  });

  it("lets a team guess one more time than the clue's number (the +1 rule)", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 1); // allows 2 guesses
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const ownCards = room.state.cards.filter((c) => c.color === activeTeam).slice(0, 2);

    for (const card of ownCards) {
      room.toggleCardSelection(activeOperative, card.id);
      const result = room.confirmGuess(activeOperative);
      expect(result.ok).toBe(true);
    }

    expect(ownCards.every((c) => room.state.cards.find((sc) => sc.id === c.id)?.revealed)).toBe(
      true,
    );
    expect(room.state.currentClue).toBeNull(); // guesses exhausted, turn auto-ended
    expect(room.state.turn).not.toBe(activeTeam);
  });

  it("rejects spectator gameplay actions with FORBIDDEN_ROLE", () => {
    const spec = room.join({ name: "Watcher", asSpectator: true });
    if (!spec.ok) throw new Error("unreachable");
    const activeCaptainId = room.state.turn === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "FRUIT", 2);

    const selectResult = room.toggleCardSelection(spec.data.id, 0);
    expect(selectResult.ok).toBe(false);
    if (selectResult.ok) throw new Error("unreachable");
    expect(selectResult.code).toBe("FORBIDDEN_ROLE");

    const clueResult = room.submitClue(spec.data.id, "X", 1);
    expect(clueResult.ok).toBe(false);
    if (clueResult.ok) throw new Error("unreachable");
    expect(clueResult.code).toBe("FORBIDDEN_ROLE");
  });

  it("ends the game when the assassin card is selected and confirmed", () => {
    const activeTeam = room.state.turn;
    const activeCaptainId = activeTeam === "red" ? red1 : blue1;
    room.submitClue(activeCaptainId, "DANGER", 1);
    const activeOperative = room.state.players.find(
      (p) => p.team === activeTeam && p.role === "operative",
    )!.id;
    const assassinCard = room.state.cards.find((c) => c.color === "assassin")!;

    room.toggleCardSelection(activeOperative, assassinCard.id);
    const result = room.confirmGuess(activeOperative);

    expect(result.ok).toBe(true);
    expect(room.state.phase).toBe("finished");
    expect(room.state.winReason).toBe("assassin_revealed");
    expect(room.state.winner).not.toBe(activeTeam);
  });
});

describe("Room disconnect removal", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room("TEST");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes a player who stays disconnected past the grace period", () => {
    const joined = room.join({ name: "Alice" });
    if (!joined.ok) throw new Error("unreachable");
    const playerId = joined.data.id;
    room.playerSockets.set(playerId, "socket-1");

    room.disconnectSocket(playerId, "socket-1");
    const onRemoved = vi.fn();
    room.scheduleRemovalIfStillDisconnected(playerId, 15_000, onRemoved);

    vi.advanceTimersByTime(15_000);

    expect(room.findPlayer(playerId)).toBeUndefined();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending removal when the player reconnects in time", () => {
    const joined = room.join({ name: "Alice" });
    if (!joined.ok) throw new Error("unreachable");
    const playerId = joined.data.id;
    room.playerSockets.set(playerId, "socket-1");

    room.disconnectSocket(playerId, "socket-1");
    const onRemoved = vi.fn();
    room.scheduleRemovalIfStillDisconnected(playerId, 15_000, onRemoved);

    vi.advanceTimersByTime(5_000);
    room.join({ name: "Alice", playerId });

    vi.advanceTimersByTime(15_000);

    expect(room.findPlayer(playerId)).toBeDefined();
    expect(room.findPlayer(playerId)?.connected).toBe(true);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("does not remove a player who reconnected before the timer fires, even without cancellation", () => {
    const joined = room.join({ name: "Alice" });
    if (!joined.ok) throw new Error("unreachable");
    const playerId = joined.data.id;

    room.markDisconnected(playerId);
    const onRemoved = vi.fn();
    room.scheduleRemovalIfStillDisconnected(playerId, 15_000, onRemoved);
    room.findPlayer(playerId)!.connected = true;

    vi.advanceTimersByTime(15_000);

    expect(room.findPlayer(playerId)).toBeDefined();
    expect(onRemoved).not.toHaveBeenCalled();
  });
});

describe("Room.allPlayersDisconnected / reset", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room("TEST");
  });

  it("allPlayersDisconnected returns false when the room is empty", () => {
    expect(room.allPlayersDisconnected()).toBe(false);
  });

  it("allPlayersDisconnected returns false while at least one player is connected", () => {
    const a = room.join({ name: "Alice" });
    const b = room.join({ name: "Bob" });
    if (!a.ok || !b.ok) throw new Error("unreachable");

    room.markDisconnected(a.data.id);
    expect(room.allPlayersDisconnected()).toBe(false);
  });

  it("allPlayersDisconnected returns true when every player is disconnected", () => {
    const a = room.join({ name: "Alice" });
    const b = room.join({ name: "Bob" });
    if (!a.ok || !b.ok) throw new Error("unreachable");

    room.markDisconnected(a.data.id);
    room.markDisconnected(b.data.id);
    expect(room.allPlayersDisconnected()).toBe(true);
  });

  it("reset clears players, game state, and pending timers", () => {
    vi.useFakeTimers();
    const a = room.join({ name: "Alice" });
    if (!a.ok) throw new Error("unreachable");
    room.playerSockets.set(a.data.id, "socket-1");

    room.disconnectSocket(a.data.id, "socket-1");
    const onRemoved = vi.fn();
    room.scheduleRemovalIfStillDisconnected(a.data.id, 15_000, onRemoved);

    room.reset();

    expect(room.state.players).toHaveLength(0);
    expect(room.state.phase).toBe("lobby");
    expect(room.playerSockets.size).toBe(0);

    // The pending timer must have been cancelled
    vi.advanceTimersByTime(15_000);
    expect(onRemoved).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("reset during an in-progress game returns the room to lobby", () => {
    const players = ["R1", "R2", "B1", "B2"].map((name) => {
      const r = room.join({ name });
      if (!r.ok) throw new Error("unreachable");
      return r.data;
    });
    room.setTeam(players[0].id, "red");
    room.setTeam(players[1].id, "red");
    room.setTeam(players[2].id, "blue");
    room.setTeam(players[3].id, "blue");
    room.becomeCaptain(players[0].id, "red");
    room.becomeCaptain(players[2].id, "blue");
    for (const p of players) room.setReady(p.id, true);
    room.startGame();
    expect(room.state.phase).toBe("in_progress");

    room.reset();

    expect(room.state.phase).toBe("lobby");
    expect(room.state.players).toHaveLength(0);
    expect(room.state.cards).toHaveLength(0);
    expect(room.state.winner).toBeNull();
  });
});
