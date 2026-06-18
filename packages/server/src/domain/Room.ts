import { randomUUID } from "node:crypto";
import {
  buildDeck,
  guessesAllowedForClue,
  otherTeam,
  pickWords,
  resolveGuess,
  TOTAL_CARD_COUNT,
  WORDLIST,
  type GameState,
  type Player,
  type TeamColor,
} from "@codenames/shared";
import { config } from "../config.js";
import { err, ok, type Result } from "./result.js";

export interface JoinParams {
  playerId?: string;
  name: string;
  asSpectator?: boolean;
}

export type CanStartReason =
  | "MIN_PLAYERS"
  | "MISSING_RED_CAPTAIN"
  | "MISSING_BLUE_CAPTAIN"
  | "NOT_ALL_READY";

export interface CanStartCheck {
  ok: boolean;
  reason?: CanStartReason;
}

export class Room {
  state: GameState;
  /** playerId -> current socket id, used for reconnection and targeted emits. */
  playerSockets: Map<string, string> = new Map();
  /** playerId -> pending removal timer, started on disconnect and cancelled on reconnect. */
  private removalTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(roomCode: string) {
    this.state = {
      roomCode,
      phase: "lobby",
      players: [],
      cards: [],
      turn: "red",
      currentClue: null,
      teams: {
        red: { color: "red", remaining: 0 },
        blue: { color: "blue", remaining: 0 },
      },
      winner: null,
      winReason: null,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
  }

  private touch(): void {
    this.state.lastActivityAt = Date.now();
  }

  findPlayer(playerId: string): Player | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  /** Creates a new player, or reconnects an existing one if `playerId` matches. */
  join(params: JoinParams): Result<Player> {
    this.touch();
    const existing = params.playerId ? this.findPlayer(params.playerId) : undefined;
    const nameTaken = this.state.players.some(
      (p) => p !== existing && p.name.toLowerCase() === params.name.toLowerCase(),
    );
    if (nameTaken) {
      return err("NAME_TAKEN", "This name is already taken");
    }
    if (existing) {
      existing.connected = true;
      existing.name = params.name;
      this.cancelScheduledRemoval(existing.id);
      return ok(existing);
    }
    const player: Player = {
      id: params.playerId ?? randomUUID(),
      name: params.name,
      team: null,
      role: params.asSpectator ? "spectator" : "operative",
      isReady: false,
      connected: true,
    };
    this.state.players.push(player);
    return ok(player);
  }

  markDisconnected(playerId: string): void {
    const player = this.findPlayer(playerId);
    if (player) {
      player.connected = false;
      this.touch();
    }
  }

  /**
   * Marks a player disconnected and drops their socket mapping, but only if
   * `socketId` is still the socket on file for them. Guards against a stale
   * socket's delayed disconnect/leave firing after that player has already
   * reconnected on a new socket (e.g. a page refresh) and clobbering the new,
   * live session.
   */
  disconnectSocket(playerId: string, socketId: string): boolean {
    if (this.playerSockets.get(playerId) !== socketId) return false;
    this.markDisconnected(playerId);
    this.playerSockets.delete(playerId);
    return true;
  }

  /**
   * Schedules `playerId` for removal after `delayMs` if they're still disconnected
   * by then. Reconnecting via `join()` cancels the pending timer. Calling this again
   * for the same player (e.g. a second disconnect) replaces the previous timer.
   */
  scheduleRemovalIfStillDisconnected(
    playerId: string,
    delayMs: number,
    onRemoved: () => void,
  ): void {
    this.cancelScheduledRemoval(playerId);
    const timer = setTimeout(() => {
      this.removalTimers.delete(playerId);
      const player = this.findPlayer(playerId);
      if (player && !player.connected) {
        this.removePlayer(playerId);
        onRemoved();
      }
    }, delayMs);
    this.removalTimers.set(playerId, timer);
  }

  cancelScheduledRemoval(playerId: string): void {
    const timer = this.removalTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.removalTimers.delete(playerId);
    }
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    this.playerSockets.delete(playerId);
    this.touch();
  }

  setTeam(playerId: string, team: TeamColor): Result<void> {
    if (this.state.phase !== "lobby") {
      return err("INVALID_TEAM", "Cannot change team after the game has started");
    }
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot join a team");

    player.team = team;
    player.role = "operative"; // switching/(re)joining a team always relinquishes captain status
    player.isReady = false; // re-confirm readiness for the new team
    this.touch();
    return ok(undefined);
  }

  becomeCaptain(playerId: string, team: TeamColor): Result<void> {
    if (this.state.phase !== "lobby") {
      return err("CANNOT_START", "Cannot change captain after the game has started");
    }
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot be captain");
    if (player.team !== team)
      return err("INVALID_TEAM", "Join this team before becoming its captain");

    const currentCaptain = this.state.players.find(
      (p) => p.team === team && p.role === "captain" && p.id !== playerId,
    );
    if (currentCaptain) {
      if (currentCaptain.connected) {
        return err("CAPTAIN_SLOT_TAKEN", "This team already has a connected captain");
      }
      currentCaptain.role = "operative"; // takeover from an abandoned captain slot
      currentCaptain.isReady = false; // re-confirm readiness now that role changed
    }

    player.role = "captain";
    player.isReady = false; // re-confirm readiness now that role changed
    this.touch();
    return ok(undefined);
  }

  setReady(playerId: string, ready: boolean): Result<void> {
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot be ready");
    player.isReady = ready;
    this.touch();
    return ok(undefined);
  }

  canStart(): CanStartCheck {
    const active = this.state.players.filter(
      (p) => p.role !== "spectator" && p.connected && p.team !== null,
    );
    const red = active.filter((p) => p.team === "red");
    const blue = active.filter((p) => p.team === "blue");

    if (red.length < config.minPlayersPerTeam || blue.length < config.minPlayersPerTeam) {
      return { ok: false, reason: "MIN_PLAYERS" };
    }
    if (!red.some((p) => p.role === "captain")) {
      return { ok: false, reason: "MISSING_RED_CAPTAIN" };
    }
    if (!blue.some((p) => p.role === "captain")) {
      return { ok: false, reason: "MISSING_BLUE_CAPTAIN" };
    }
    if (!active.every((p) => p.isReady)) {
      return { ok: false, reason: "NOT_ALL_READY" };
    }
    return { ok: true };
  }

  startGame(): Result<void> {
    if (this.state.phase !== "lobby") return err("CANNOT_START", "Game already started");
    const check = this.canStart();
    if (!check.ok) return err("CANNOT_START", check.reason ?? "Cannot start game");

    const words = pickWords(WORDLIST, TOTAL_CARD_COUNT);
    const { cards, startingTeam } = buildDeck(words);

    this.state.cards = cards;
    this.state.turn = startingTeam;
    this.state.phase = "in_progress";
    this.state.currentClue = null;
    this.state.winner = null;
    this.state.winReason = null;
    this.state.teams = {
      red: { color: "red", remaining: cards.filter((c) => c.color === "red").length },
      blue: { color: "blue", remaining: cards.filter((c) => c.color === "blue").length },
    };
    this.touch();
    return ok(undefined);
  }

  submitClue(playerId: string, word: string, number: number): Result<void> {
    if (this.state.phase !== "in_progress")
      return err("GAME_ALREADY_FINISHED", "Game is not in progress");
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot submit clues");
    if (player.role !== "captain" || player.team !== this.state.turn) {
      return err("NOT_CAPTAIN", "Only the active team's captain can submit a clue");
    }
    if (this.state.currentClue)
      return err("CLUE_ALREADY_ACTIVE", "A clue is already active this turn");

    const trimmed = word.trim();
    if (!trimmed) return err("INVALID_CLUE", "Clue word cannot be empty");
    if (!Number.isInteger(number) || number < 0)
      return err("INVALID_CLUE", "Clue number must be a non-negative integer");

    this.state.currentClue = {
      word: trimmed,
      number,
      byPlayerId: playerId,
      guessesRemaining: guessesAllowedForClue(number),
    };
    this.touch();
    return ok(undefined);
  }

  revealCard(playerId: string, cardId: number): Result<void> {
    if (this.state.phase !== "in_progress")
      return err("GAME_ALREADY_FINISHED", "Game is not in progress");
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot reveal cards");
    if (player.team !== this.state.turn) return err("NOT_YOUR_TURN", "It is not your team's turn");
    if (player.role === "captain") return err("FORBIDDEN_ROLE", "Captains cannot reveal cards");
    if (!this.state.currentClue) return err("NO_ACTIVE_CLUE", "No active clue to guess against");

    const card = this.state.cards.find((c) => c.id === cardId);
    if (!card) return err("CARD_NOT_FOUND", `No card with id ${cardId}`);
    if (card.revealed) return err("CARD_ALREADY_REVEALED", "This card has already been revealed");

    const result = resolveGuess(this.state, cardId, this.state.currentClue.guessesRemaining);
    this.state.cards = result.cards;
    this.state.teams = result.teams;

    if (result.winner) {
      this.state.winner = result.winner;
      this.state.winReason = result.winReason;
      this.state.phase = "finished";
      this.state.currentClue = null;
      this.state.turn = result.nextTurn;
    } else if (result.turnEnded) {
      this.state.turn = result.nextTurn;
      this.state.currentClue = null;
    } else {
      this.state.currentClue = {
        ...this.state.currentClue,
        guessesRemaining: result.guessesRemaining,
      };
    }
    this.touch();
    return ok(undefined);
  }

  endTurn(playerId: string): Result<void> {
    if (this.state.phase !== "in_progress")
      return err("GAME_ALREADY_FINISHED", "Game is not in progress");
    const player = this.findPlayer(playerId);
    if (!player) return err("PLAYER_NOT_FOUND", "Player not found in this room");
    if (player.role === "spectator") return err("FORBIDDEN_ROLE", "Spectators cannot end the turn");
    if (player.team !== this.state.turn) return err("NOT_YOUR_TURN", "It is not your team's turn");
    if (!this.state.currentClue) return err("NO_ACTIVE_CLUE", "No active clue to pass on");

    this.state.turn = otherTeam(this.state.turn);
    this.state.currentClue = null;
    this.touch();
    return ok(undefined);
  }
}
