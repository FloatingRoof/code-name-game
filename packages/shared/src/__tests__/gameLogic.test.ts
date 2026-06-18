import { describe, expect, it } from "vitest";
import {
  ASSASSIN_CARD_COUNT,
  NEUTRAL_CARD_COUNT,
  OTHER_TEAM_CARD_COUNT,
  STARTING_TEAM_CARD_COUNT,
  buildDeck,
  determineStartingTeam,
  evaluateWin,
  guessesAllowedForClue,
  pickWords,
  resolveGuess,
} from "../gameLogic.js";
import { WORDLIST } from "../wordlist.js";
import type { Card, GameState } from "../types.js";

function sequentialRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("determineStartingTeam", () => {
  it("picks red when rng returns < 0.5", () => {
    expect(determineStartingTeam(() => 0)).toBe("red");
  });

  it("picks blue when rng returns >= 0.5", () => {
    expect(determineStartingTeam(() => 0.999)).toBe("blue");
  });
});

describe("pickWords", () => {
  it("returns exactly N unique words drawn from the pool", () => {
    const words = pickWords(WORDLIST, 25, () => 0.42);
    expect(words).toHaveLength(25);
    expect(new Set(words).size).toBe(25);
    for (const w of words) {
      expect(WORDLIST).toContain(w);
    }
  });

  it("throws if count exceeds pool size", () => {
    expect(() => pickWords(["A", "B"], 3)).toThrow();
  });
});

describe("buildDeck", () => {
  it("produces the standard 9/8/7/1 distribution and unique words", () => {
    const words = pickWords(WORDLIST, 25, () => 0.1);
    const { cards, startingTeam } = buildDeck(words, () => 0.1);

    expect(cards).toHaveLength(25);
    expect(new Set(cards.map((c) => c.word)).size).toBe(25);
    expect(cards.every((c) => c.revealed === false)).toBe(true);

    const second = startingTeam === "red" ? "blue" : "red";
    const counts = cards.reduce<Record<string, number>>((acc, c) => {
      acc[c.color] = (acc[c.color] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts[startingTeam]).toBe(STARTING_TEAM_CARD_COUNT);
    expect(counts[second]).toBe(OTHER_TEAM_CARD_COUNT);
    expect(counts.neutral).toBe(NEUTRAL_CARD_COUNT);
    expect(counts.assassin).toBe(ASSASSIN_CARD_COUNT);
  });

  it("throws if not given exactly 25 words", () => {
    expect(() => buildDeck(["A", "B"])).toThrow();
  });

  it("is deterministic for a given rng sequence", () => {
    const words = pickWords(WORDLIST, 25, () => 0.1);
    const a = buildDeck(words, sequentialRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    const b = buildDeck(words, sequentialRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(a.startingTeam).toBe(b.startingTeam);
    expect(a.cards.map((c) => c.color)).toEqual(b.cards.map((c) => c.color));
  });
});

describe("guessesAllowedForClue", () => {
  it("treats 0 as effectively unlimited (capped at board size)", () => {
    expect(guessesAllowedForClue(0)).toBe(25);
  });

  it("allows number + 1 guesses otherwise", () => {
    expect(guessesAllowedForClue(2)).toBe(3);
    expect(guessesAllowedForClue(1)).toBe(2);
  });
});

describe("evaluateWin", () => {
  it("declares red winner when red has 0 remaining", () => {
    const result = evaluateWin({
      teams: { red: { color: "red", remaining: 0 }, blue: { color: "blue", remaining: 3 } },
    });
    expect(result).toEqual({ winner: "red", reason: "all_words_found" });
  });

  it("declares blue winner when blue has 0 remaining", () => {
    const result = evaluateWin({
      teams: { red: { color: "red", remaining: 2 }, blue: { color: "blue", remaining: 0 } },
    });
    expect(result).toEqual({ winner: "blue", reason: "all_words_found" });
  });

  it("returns null mid-game", () => {
    const result = evaluateWin({
      teams: { red: { color: "red", remaining: 4 }, blue: { color: "blue", remaining: 3 } },
    });
    expect(result).toBeNull();
  });
});

function makeState(
  cards: Card[],
  turn: GameState["turn"] = "red",
): Pick<GameState, "cards" | "teams" | "turn"> {
  const count = (color: string) => cards.filter((c) => c.color === color && !c.revealed).length;
  return {
    cards,
    turn,
    teams: {
      red: { color: "red", remaining: count("red") },
      blue: { color: "blue", remaining: count("blue") },
    },
  };
}

describe("resolveGuess", () => {
  it("own color: continues turn and decrements own remaining when guesses remain", () => {
    const cards: Card[] = [
      { id: 0, word: "A", color: "red", revealed: false },
      { id: 1, word: "B", color: "red", revealed: false },
      { id: 2, word: "C", color: "blue", revealed: false },
    ];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, /* guessesRemainingBeforeGuess */ 2);
    expect(result.outcome).toBe("own");
    expect(result.turnEnded).toBe(false);
    expect(result.nextTurn).toBe("red");
    expect(result.guessesRemaining).toBe(1);
    expect(result.teams.red.remaining).toBe(1);
    expect(result.winner).toBeNull();
  });

  it("own color: ends turn when guesses are exhausted", () => {
    const cards: Card[] = [
      { id: 0, word: "A", color: "red", revealed: false },
      { id: 1, word: "B", color: "red", revealed: false },
      { id: 2, word: "C", color: "blue", revealed: false },
    ];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 1);
    expect(result.outcome).toBe("own");
    expect(result.turnEnded).toBe(true);
    expect(result.nextTurn).toBe("blue");
  });

  it("own color: triggers win when it was the last own card", () => {
    const cards: Card[] = [{ id: 0, word: "A", color: "red", revealed: false }];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 3);
    expect(result.winner).toBe("red");
    expect(result.winReason).toBe("all_words_found");
    expect(result.turnEnded).toBe(true);
  });

  it("neutral color: ends turn, no score change", () => {
    const cards: Card[] = [
      { id: 0, word: "A", color: "neutral", revealed: false },
      { id: 1, word: "B", color: "red", revealed: false },
      { id: 2, word: "C", color: "blue", revealed: false },
    ];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 2);
    expect(result.outcome).toBe("neutral");
    expect(result.turnEnded).toBe(true);
    expect(result.nextTurn).toBe("blue");
    expect(result.teams.red.remaining).toBe(1);
  });

  it("opponent color: ends turn and decrements opponent remaining", () => {
    const cards: Card[] = [
      { id: 0, word: "A", color: "blue", revealed: false },
      { id: 1, word: "B", color: "blue", revealed: false },
      { id: 2, word: "C", color: "red", revealed: false },
    ];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 2);
    expect(result.outcome).toBe("opponent");
    expect(result.turnEnded).toBe(true);
    expect(result.nextTurn).toBe("blue");
    expect(result.teams.blue.remaining).toBe(1);
  });

  it("opponent color: can win the game for the opponent if it was their last card", () => {
    const cards: Card[] = [
      { id: 0, word: "A", color: "blue", revealed: false },
      { id: 1, word: "B", color: "red", revealed: false },
    ];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 2);
    expect(result.winner).toBe("blue");
    expect(result.winReason).toBe("all_words_found");
  });

  it("assassin: instant loss for the guessing team", () => {
    const cards: Card[] = [{ id: 0, word: "A", color: "assassin", revealed: false }];
    const state = makeState(cards, "red");
    const result = resolveGuess(state, 0, 2);
    expect(result.outcome).toBe("assassin");
    expect(result.turnEnded).toBe(true);
    expect(result.winner).toBe("blue");
    expect(result.winReason).toBe("assassin_revealed");
  });

  it("throws when guessing an already-revealed card", () => {
    const cards: Card[] = [{ id: 0, word: "A", color: "red", revealed: true }];
    const state = makeState(cards, "red");
    expect(() => resolveGuess(state, 0, 2)).toThrow();
  });

  it("throws when the card id does not exist", () => {
    const cards: Card[] = [{ id: 0, word: "A", color: "red", revealed: false }];
    const state = makeState(cards, "red");
    expect(() => resolveGuess(state, 99, 2)).toThrow();
  });
});
