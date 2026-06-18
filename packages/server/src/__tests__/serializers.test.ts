import { describe, expect, it } from "vitest";
import type { GameState } from "@codenames/shared";
import { toPublicState } from "../domain/serializers.js";

function makeState(phase: GameState["phase"] = "in_progress"): GameState {
  return {
    roomCode: "MAIN",
    phase,
    players: [
      { id: "cap", name: "Captain", team: "red", role: "captain", isReady: true, connected: true },
      {
        id: "op",
        name: "Operative",
        team: "red",
        role: "operative",
        isReady: true,
        connected: true,
      },
      {
        id: "spec",
        name: "Spectator",
        team: null,
        role: "spectator",
        isReady: true,
        connected: true,
      },
    ],
    cards: [
      { id: 0, word: "APPLE", color: "red", revealed: false },
      { id: 1, word: "ROBOT", color: "assassin", revealed: false },
      { id: 2, word: "MOON", color: "blue", revealed: true },
    ],
    turn: "red",
    currentClue: null,
    teams: { red: { color: "red", remaining: 1 }, blue: { color: "blue", remaining: 0 } },
    winner: null,
    winReason: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

describe("toPublicState", () => {
  it("reveals all colors to the captain", () => {
    const pub = toPublicState(makeState(), "cap");
    expect(pub.viewerRole).toBe("captain");
    expect(pub.cards.find((c) => c.id === 0)?.color).toBe("red");
    expect(pub.cards.find((c) => c.id === 1)?.color).toBe("assassin");
  });

  it("hides unrevealed colors from an operative, but shows revealed ones", () => {
    const pub = toPublicState(makeState(), "op");
    expect(pub.viewerRole).toBe("operative");
    expect(pub.cards.find((c) => c.id === 0)?.color).toBeNull();
    expect(pub.cards.find((c) => c.id === 1)?.color).toBeNull();
    expect(pub.cards.find((c) => c.id === 2)?.color).toBe("blue"); // already revealed
  });

  it("hides unrevealed colors from a spectator just like an operative", () => {
    const pub = toPublicState(makeState(), "spec");
    expect(pub.viewerRole).toBe("spectator");
    expect(pub.cards.find((c) => c.id === 0)?.color).toBeNull();
  });

  it("reveals all colors to everyone once the game is finished", () => {
    const pub = toPublicState(makeState("finished"), "op");
    expect(pub.cards.find((c) => c.id === 0)?.color).toBe("red");
    expect(pub.cards.find((c) => c.id === 1)?.color).toBe("assassin");
  });

  it("falls back to spectator visibility for an unknown viewer id", () => {
    const pub = toPublicState(makeState(), "ghost");
    expect(pub.viewerRole).toBe("spectator");
    expect(pub.cards.find((c) => c.id === 0)?.color).toBeNull();
  });
});
