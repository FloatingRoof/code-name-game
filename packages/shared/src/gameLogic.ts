import type { Card, CardColor, GameState, TeamColor } from "./types.js";

export const STARTING_TEAM_CARD_COUNT = 9;
export const OTHER_TEAM_CARD_COUNT = 8;
export const NEUTRAL_CARD_COUNT = 7;
export const ASSASSIN_CARD_COUNT = 1;
export const TOTAL_CARD_COUNT =
  STARTING_TEAM_CARD_COUNT + OTHER_TEAM_CARD_COUNT + NEUTRAL_CARD_COUNT + ASSASSIN_CARD_COUNT;

export function otherTeam(team: TeamColor): TeamColor {
  return team === "red" ? "blue" : "red";
}

/** Fisher-Yates shuffle. Does not mutate the input array. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function determineStartingTeam(rng: () => number = Math.random): TeamColor {
  return rng() < 0.5 ? "red" : "blue";
}

/** Picks `count` unique words at random from `pool`. Throws if the pool is too small. */
export function pickWords(
  pool: readonly string[],
  count: number,
  rng: () => number = Math.random,
): string[] {
  if (count > pool.length) {
    throw new Error(`Cannot pick ${count} words from a pool of ${pool.length}`);
  }
  return shuffle(pool, rng).slice(0, count);
}

export interface BuiltDeck {
  cards: Card[];
  startingTeam: TeamColor;
}

/** Builds the 25-card deck with the standard 9/8/7/1 color distribution. */
export function buildDeck(words: readonly string[], rng: () => number = Math.random): BuiltDeck {
  if (words.length !== TOTAL_CARD_COUNT) {
    throw new Error(`buildDeck requires exactly ${TOTAL_CARD_COUNT} words, got ${words.length}`);
  }
  const startingTeam = determineStartingTeam(rng);
  const second = otherTeam(startingTeam);

  const colors: CardColor[] = [
    ...Array<CardColor>(STARTING_TEAM_CARD_COUNT).fill(startingTeam),
    ...Array<CardColor>(OTHER_TEAM_CARD_COUNT).fill(second),
    ...Array<CardColor>(NEUTRAL_CARD_COUNT).fill("neutral"),
    ...Array<CardColor>(ASSASSIN_CARD_COUNT).fill("assassin"),
  ];
  const shuffledColors = shuffle(colors, rng);

  const cards: Card[] = words.map((word, id) => ({
    id,
    word,
    color: shuffledColors[id],
    revealed: false,
  }));

  return { cards, startingTeam };
}

export interface WinResult {
  winner: TeamColor;
  reason: "all_words_found";
}

/** Pure check of the word-count win condition only (assassin loss is handled in resolveGuess). */
export function evaluateWin(state: Pick<GameState, "teams">): WinResult | null {
  if (state.teams.red.remaining <= 0) {
    return { winner: "red", reason: "all_words_found" };
  }
  if (state.teams.blue.remaining <= 0) {
    return { winner: "blue", reason: "all_words_found" };
  }
  return null;
}

export type GuessOutcome = "own" | "neutral" | "opponent" | "assassin";

export interface ResolveGuessResult {
  cards: Card[];
  teams: GameState["teams"];
  outcome: GuessOutcome;
  turnEnded: boolean;
  nextTurn: TeamColor;
  guessesRemaining: number;
  winner: TeamColor | null;
  winReason: "all_words_found" | "assassin_revealed" | null;
}

/**
 * Resolves a single card guess for `guessingTeam`. Pure function: returns the
 * next cards/teams/turn rather than mutating `state`.
 */
export function resolveGuess(
  state: Pick<GameState, "cards" | "teams" | "turn">,
  cardId: number,
  guessesRemainingBeforeGuess: number,
): ResolveGuessResult {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`No card with id ${cardId}`);
  }
  if (card.revealed) {
    throw new Error(`Card ${cardId} is already revealed`);
  }

  const guessingTeam = state.turn;
  const cards = state.cards.map((c) => (c.id === cardId ? { ...c, revealed: true } : c));
  const teams = { red: { ...state.teams.red }, blue: { ...state.teams.blue } };

  let outcome: GuessOutcome;
  if (card.color === "assassin") {
    outcome = "assassin";
  } else if (card.color === "neutral") {
    outcome = "neutral";
  } else if (card.color === guessingTeam) {
    outcome = "own";
    teams[card.color].remaining -= 1;
  } else {
    outcome = "opponent";
    teams[card.color].remaining -= 1;
  }

  if (outcome === "assassin") {
    return {
      cards,
      teams,
      outcome,
      turnEnded: true,
      nextTurn: otherTeam(guessingTeam),
      guessesRemaining: 0,
      winner: otherTeam(guessingTeam),
      winReason: "assassin_revealed",
    };
  }

  const wordWin = evaluateWin({ teams });
  if (wordWin) {
    return {
      cards,
      teams,
      outcome,
      turnEnded: true,
      nextTurn: guessingTeam,
      guessesRemaining: 0,
      winner: wordWin.winner,
      winReason: wordWin.reason,
    };
  }

  if (outcome === "own") {
    const remainingGuesses = guessesRemainingBeforeGuess - 1;
    if (remainingGuesses > 0) {
      return {
        cards,
        teams,
        outcome,
        turnEnded: false,
        nextTurn: guessingTeam,
        guessesRemaining: remainingGuesses,
        winner: null,
        winReason: null,
      };
    }
    return {
      cards,
      teams,
      outcome,
      turnEnded: true,
      nextTurn: otherTeam(guessingTeam),
      guessesRemaining: 0,
      winner: null,
      winReason: null,
    };
  }

  // neutral or opponent color: turn always ends immediately
  return {
    cards,
    teams,
    outcome,
    turnEnded: true,
    nextTurn: otherTeam(guessingTeam),
    guessesRemaining: 0,
    winner: null,
    winReason: null,
  };
}

/** Per official rules, a clue number of 0 grants effectively-unlimited guesses (capped by board size). */
export function guessesAllowedForClue(number: number): number {
  return number === 0 ? TOTAL_CARD_COUNT : number + 1;
}
