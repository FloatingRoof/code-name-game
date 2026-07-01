# Backend Documentation

This document describes the Codenames backend as implemented: monorepo layout, domain model,
Socket.IO contract, security/visibility model, and test coverage.

## Monorepo layout

```
codenames/
  package.json              # npm workspaces root: dev:server, build, test, typecheck, lint, format
  tsconfig.base.json         # ES2022, NodeNext modules, strict mode
  eslint.config.js           # typescript-eslint + eslint-config-prettier
  .prettierrc.json
  packages/
    shared/                  # @codenames/shared — types + pure game logic (no I/O)
    server/                  # @codenames/server — Express + Socket.IO
```

Root scripts run across both workspaces (e.g. `npm run test` runs shared tests then server tests).

## packages/shared

Pure, framework-agnostic code shared by server (and, later, client).

- **`src/types.ts`** — domain types: `TeamColor`, `CardColor`, `PlayerRole`
  (`"captain" | "operative" | "spectator"`), `GamePhase`, `WinReason`, `Player`, `Card`, `Clue`,
  `TeamState`, `GameState` (server-side truth, includes real card colors), `PublicCard`,
  `PublicGameState` (client-safe projection, see "Visibility model" below).
- **`src/events.ts`** — the Socket.IO contract as TypeScript types: `ClientEvent`/`ServerEvent`
  string-constant maps, every payload/ack type, `ErrorCode` union, `AckResponse<T>`.
- **`src/wordlist.ts`** — `WORDLIST`, ~250 generic English nouns used to build the board.
- **`src/gameLogic.ts`** — pure, RNG-injectable game rules:
  - Constants: `STARTING_TEAM_CARD_COUNT=9`, `OTHER_TEAM_CARD_COUNT=8`, `NEUTRAL_CARD_COUNT=7`,
    `ASSASSIN_CARD_COUNT=1`, `TOTAL_CARD_COUNT=25`.
  - `shuffle(array, rng)` — Fisher-Yates, deterministic given an injected `rng`.
  - `determineStartingTeam(rng)` — 50/50 red/blue.
  - `pickWords(pool, count, rng)` — random sample without replacement.
  - `buildDeck(words, rng)` — assembles the 25-card deck with the 9/8/7/1 color distribution,
    returns `{ cards, startingTeam }`.
  - `evaluateWin(state)` — returns `{ winner, reason: "all_words_found" }` or `null`.
  - `resolveGuess(state, cardId, guessesRemainingBeforeGuess)` — the core turn-resolution
    function. Given a guessed card, returns updated `cards`/`teams`, the `outcome`
    (own/neutral/opponent/assassin), whether the turn ended, the next turn, remaining guesses,
    and winner/winReason if the guess ended the game. Used by `Room.confirmGuess` but fully
    testable without any server/socket scaffolding.
  - `guessesAllowedForClue(number)` — `0` (unlimited) maps to 25 guesses, otherwise `number + 1`
    (standard "+1" Codenames rule).
- **`src/index.ts`** — barrel export.

All of the above is unit-tested in `src/__tests__/gameLogic.test.ts` (21 tests): starting-team
randomness, word-picking, deck distribution and determinism under a stub RNG, the guess-count
formula, every `evaluateWin` branch, and every `resolveGuess` outcome (own color continues,
neutral/opponent end the turn, assassin ends the game, win-by-last-card detection).

## packages/server

### Bootstrapping

- **`src/config.ts`** — reads env vars with `parsePositiveInt` validation: `port`,
  `clientOrigin`, `minPlayersPerTeam`, `defaultRoomCode`.
- **`src/app.ts`** — `createApp()`: Express app with `cors` and a `/health` route.
- **`src/index.ts`** — creates the HTTP server, a typed
  `Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>`, registers
  socket handlers, and listens on `config.port`.

### Domain layer (`src/domain/`)

The domain layer holds all game-rule validation and state mutation. It has no knowledge of
Socket.IO and is fully unit-testable in isolation.

- **`result.ts`** — `Result<T> = OkResult<T> | ErrorResult`, with `ok(data)` / `err(code, message)`
  helpers. Every domain mutation returns a `Result`, decoupling rule validation from how it's
  eventually reported to a client (ack error vs. thrown exception).
- **`roomCode.ts`** — `generateRoomCode(length=4)`, using an alphabet that excludes
  visually-ambiguous characters.
- **`store.ts`** — `Map<roomCode, Room>` plus `getRoom`, `createRoom`, `getOrCreateRoom`,
  `deleteRoom`, `allRooms`. This is multi-room-ready even though MVP only ever uses one room.
- **`defaultRoom.ts`** — `ensureDefaultRoom()` = `getOrCreateRoom(config.defaultRoomCode)`. This is
  the _only_ place that hardcodes the single-room MVP assumption; the store and `Room` class know
  nothing about there being just one room.
- **`Room.ts`** — the stateful core. Holds `state: GameState` and `playerSockets: Map<playerId,
socketId>` (used for reconnection and targeted emits). Key methods:
  - `join({ playerId?, name, asSpectator? })` — creates a new player, or reconnects an existing
    one (matched by `playerId`) and flips `connected: true`. Rejects with `NAME_TAKEN` if another
    player already has the same name (case-insensitive) — checked against every other player,
    including on reconnect, so a reconnecting player can't rename themselves into a collision.
  - `markDisconnected(playerId)` — flags a player `connected: false` without removing them.
  - `disconnectSocket(playerId, socketId)` — guarded version of the above: only marks
    disconnected and clears the `playerSockets` entry if `socketId` is still the socket on file
    for that player. This prevents a race where a stale socket's delayed `disconnect` event
    fires _after_ the same player has already reconnected on a new socket (e.g. page refresh),
    which would otherwise clobber the live session's connectivity state.
  - `setTeam(playerId, team)` — rejects spectators (`FORBIDDEN_ROLE`) and mid-game changes
    (`INVALID_TEAM`); switching team always demotes the player to `operative` and resets
    `isReady`.
  - `becomeCaptain(playerId, team)` — rejects spectators, wrong team, and mid-game changes.
    Allows "takeover": if the team's current captain is disconnected, the new player replaces
    them (the old captain is demoted to `operative` and their `isReady` is reset too); if the
    current captain is still connected, returns `CAPTAIN_SLOT_TAKEN`.
  - `setReady(playerId, ready)` — rejects spectators.
  - `canStart()` — returns `{ ok, reason? }` with `reason` one of `MIN_PLAYERS`,
    `MISSING_RED_CAPTAIN`, `MISSING_BLUE_CAPTAIN`, `NOT_ALL_READY`. Only players with a team
    assigned (`team !== null`) and who are connected, non-spectator count toward these checks —
    a player who joined but never picked a team cannot block the lobby from starting.
  - `startGame()` — builds the deck via `pickWords` + `buildDeck`, sets `phase: "in_progress"`.
  - `submitClue(playerId, word, number)` — validates: game in progress, player is the active
    team's captain, no clue already active this turn, non-empty word, valid non-negative integer
    number.
  - `toggleCardSelection(playerId, cardId)` — validates: game in progress, operative on the
    active team, a clue is active, the card exists and isn't already revealed. Stages at most one
    tentative pick at a time: selecting a different card while one is already staged replaces it;
    selecting the same card again deselects it. The staged id is stored in `state.selectedCardIds`
    and visible to all viewers (it doesn't leak colors), allowing the team to discuss before
    committing.
  - `confirmGuess(playerId)` — validates: game in progress, operative on the active team, a clue
    is active, exactly one card is staged. Calls `resolveGuess` to reveal the card. Own-color
    correct guess: turn continues (unless the guess budget is exhausted). Any other outcome
    (neutral, opponent, assassin) or hitting the budget: turn ends immediately (or game ends on
    assassin). Always clears `selectedCardIds`.
  - `endTurn(playerId)` — validates: game in progress, operative (captains are rejected with
    `FORBIDDEN_ROLE`) on the active team, a clue is active, at least one guess has been confirmed
    this turn (`guessesUsed ≥ 1`). Passes the turn to the other team and clears the clue and
    selection. Does not reveal anything — card revelation happens only in `confirmGuess`.
  - `allPlayersDisconnected()` — returns `true` if every player in the room has `connected: false`
    (always `false` for an empty room).
  - `reset()` — clears all players, game state, and pending removal timers, returning the room to
    its initial lobby state. Called automatically when `allPlayersDisconnected()` becomes true.
- **`serializers.ts`** — `toPublicState(state, viewerPlayerId)`: the single chokepoint that
  converts server-side `GameState` into a `PublicGameState` safe to send to one specific viewer.
  See "Visibility model" below.

### Socket layer (`src/socket/`)

- **`types.ts`** — `SocketData { playerId?, roomCode? }`; `AckCallback<T>`; the full
  `ClientToServerEvents` map (`join_game`, `select_team`, `become_captain`, `player_ready`,
  `start_game`, `submit_clue`, `toggle_card_selection`, `end_turn`, `leave_game`,
  `request_state`), each with a typed payload and ack signature; `ServerToClientEvents`
  (`game_state_update`, `error`, `player_joined`, `player_left`, `game_over`);
  `InterServerEvents = Record<string, never>`.
- **`context.ts`** — shared socket-handler plumbing:
  - `errorAck(code, message)` — builds a failed `AckResponse`.
  - `getRoomForSocket(socket)` — looks up the room from `socket.data.roomCode`.
  - `requireRoomAndPlayer<T>(socket, ack)` — generic helper that resolves `{ room, playerId }` or
    sends an error ack and returns `undefined`; used at the top of every mutating handler to
    avoid repeating the same null-checks.
  - `respondToMutation<T>(io, room, result, ack)` — takes a domain `Result<T>`, acks success/
    failure accordingly, and on success triggers `broadcastRoomState`.
  - `broadcastRoomState(io, room)` — iterates `room.state.players`, and for each connected player
    emits `game_state_update` with `toPublicState(room.state, player.id)` **only to that player's
    socket** via `room.playerSockets`. This is the structural enforcement of the visibility model
    — there is no room-wide broadcast of game state anywhere in the codebase.
- **`handlers/roomHandlers.ts`** — identity/connection lifecycle:
  - `join_game` — validates/trims `playerName`, ensures the default room exists, calls
    `room.join(...)`, stores `playerId`/`roomCode` on the socket, registers the socket in
    `room.playerSockets`, joins the Socket.IO room, broadcasts state, acks
    `{ playerId, roomCode }`.
  - `request_state` — re-registers the current socket in `playerSockets` (covers reconnecting on
    a fresh socket) and re-broadcasts state immediately rather than waiting for the next mutation.
  - `leave_game` — calls `room.disconnectSocket`, notifies the room, clears `socket.data`, leaves
    the Socket.IO room.
  - `disconnect` — same disconnection handling as `leave_game`, triggered by the transport itself.
- **`handlers/lobbyHandlers.ts`** — `select_team`, `become_captain`, `player_ready`, `start_game`,
  each implemented as `requireRoomAndPlayer` + the matching `Room` method + `respondToMutation`.
- **`handlers/gameHandlers.ts`** — `submit_clue`, `toggle_card_selection`, `confirm_guess`,
  `end_turn`. `confirm_guess` additionally checks the (now-updated) `room.state` after a
  successful mutation and, if the guess ended the game, emits a non-authoritative `game_over`
  event (`{ winner, reason }`) to the whole room as UX sugar — `game_state_update` remains the
  source of truth.
- **`index.ts`** — `registerSocketHandlers(io)`, wires all three handler modules onto every new
  connection.

## Visibility model (security property)

The raw `GameState` (with true card colors) never reaches a socket directly. Every state push
goes through `toPublicState(state, viewerPlayerId)`:

- The viewer's role is looked up from `state.players`; an unknown viewer defaults to the most
  restrictive visibility (`spectator`).
- Unrevealed card colors are included only if `viewerRole === "captain"` **or** the game has
  finished (`phase === "finished"`, at which point the full board is revealed to everyone).
- `operative` and `spectator` get identical visibility: revealed cards show their true color,
  unrevealed cards have `color: null`. The only difference between the two roles is which
  mutating actions they're allowed to perform — spectators are rejected with `FORBIDDEN_ROLE` on
  every action that touches team/role/game state.

Because visibility is per-viewer, state is always sent via **targeted per-socket emit**
(`io.to(socketId).emit(...)`), never via room broadcast — see `broadcastRoomState` above. This
makes the leakage class of bug (an operative receiving spymaster-only data) structurally
impossible rather than something that depends on remembering to filter correctly client-side.

## Socket.IO event contract

**Client → server** (all ack-based, `AckResponse<T>` on the callback):

| Event                   | Payload                                   | Notes                                                                                                                               |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `join_game`             | `{ playerName, playerId?, asSpectator? }` | Creates or reconnects a player                                                                                                      |
| `select_team`           | `{ team }`                                | Lobby only; rejects spectators                                                                                                      |
| `become_captain`        | `{ team }`                                | Lobby only; supports takeover of an abandoned slot                                                                                  |
| `player_ready`          | `{ ready }`                               | Rejects spectators                                                                                                                  |
| `start_game`            | —                                         | Validated by `canStart()`                                                                                                           |
| `submit_clue`           | `{ word, number }`                        | Active team's captain only                                                                                                                           |
| `toggle_card_selection` | `{ cardId }`                              | Active team's operative only; stages at most one tentative pick visible to all — doesn't reveal it                                                   |
| `confirm_guess`         | —                                         | Active team's operative only; reveals the currently staged card; turn continues on a correct guess or ends immediately on neutral/opponent/assassin   |
| `end_turn`              | —                                         | Active team's operative only; requires at least one confirmed guess this turn; passes the turn without revealing anything                             |
| `leave_game`            | —                                         | Marks disconnected, clears socket data                                                                                              |
| `request_state`         | —                                         | Forces an immediate re-broadcast to the caller                                                                                      |

**Server → client:**

- `game_state_update` — the single source of truth, a per-socket `PublicGameState`.
- `error` — `{ code, message }`, sent via ack on a rejected mutation.
- `player_joined` / `player_left` / `game_over` — optional, non-authoritative UX sugar layered on
  top of `game_state_update`; not load-bearing for correctness.

### Error codes

`PLAYER_NOT_FOUND`, `FORBIDDEN_ROLE`, `INVALID_TEAM`, `CAPTAIN_SLOT_TAKEN`, `CANNOT_START`,
`GAME_ALREADY_FINISHED`, `NOT_CAPTAIN`, `CLUE_ALREADY_ACTIVE`, `INVALID_CLUE`, `NOT_YOUR_TURN`,
`NO_ACTIVE_CLUE`, `NO_CARD_SELECTED`, `MUST_GUESS_FIRST`, `CARD_NOT_FOUND`,
`CARD_ALREADY_REVEALED`, `INVALID_NAME`, `NAME_TAKEN`, `ROOM_NOT_FOUND`.

## Reconnection

The client (when built) will persist `playerId`/`roomCode` in `localStorage` and pass them in
`join_game`. Server-side, reconnection is already fully handled:

- `Room.join` matches an incoming `playerId` against existing players and flips
  `connected: true` rather than creating a duplicate.
- Disconnected players are never removed from `players[]`, only flagged `connected: false`, so
  team/role/ready state survives a refresh.
- `Room.disconnectSocket` guards against a stale socket's delayed `disconnect` firing after the
  same player already reconnected on a new socket — it only acts if the socket ID passed in still
  matches the one on file in `playerSockets`.
- If a captain disconnects, a teammate can claim the captain slot via `become_captain`
  (`Room.becomeCaptain` takeover branch). If the original captain later reconnects, they come
  back as a plain `operative` (not auto-restored to captain), with `isReady` reset.

## Testing

All tests run via `npm run test` (root) or per-package `npm run test -w @codenames/<pkg>`.

- **`packages/shared/src/__tests__/gameLogic.test.ts`** (21 tests) — `determineStartingTeam`,
  `pickWords`, `buildDeck` (distribution + determinism under a stub RNG), `guessesAllowedForClue`,
  `evaluateWin`, and every `resolveGuess` outcome branch.
- **`packages/server/src/__tests__/Room.test.ts`** (42 tests) — lobby flow (join/reconnect,
  duplicate-name rejection, spectator restrictions, captain-takeover rules, every `canStart()`
  rejection reason, `startGame`), disconnect-removal timers, `allPlayersDisconnected`/`reset`
  (empty room, partial disconnect, full disconnect, reset during in-progress game), gameplay flow
  (clue validation, `toggleCardSelection` validation and toggling, `confirmGuess` reveal outcomes,
  `endTurn` requires operative and at least one confirmed guess, spectator and captain rejection on
  every operative action, assassin instant loss).
- **`packages/server/src/__tests__/serializers.test.ts`** (6 tests) — captain sees all colors;
  operative hides unrevealed colors but shows revealed ones; spectator matches operative
  visibility; a finished game reveals everything; an unknown viewer defaults to
  spectator-level visibility; `selectedCardIds` passes through unchanged for every viewer.
- **`packages/server/src/__tests__/e2e/`** — real HTTP + Socket.IO server spun up on a random
  port (`testServer.ts`), driven by real `socket.io-client` connections (`testClient.ts`,
  `lobbyFixture.ts` for a reusable 2v2 ready lobby):
  - `fullFlow.test.ts` (1 test) — full lobby → start → sequential select-then-end-turn reveal of
    all 9 starting-team cards across turn switches → win by `all_words_found`; asserts per-role
    visibility at each stage, including full-board reveal to everyone once the game finishes.
  - `assassin.test.ts` (1 test) — selecting the assassin card and ending the turn ends the game
    immediately with `winReason: "assassin_revealed"` and the revealing team losing.
  - `forbiddenActions.test.ts` (6 tests) — `CANNOT_START` on an unready lobby; `FORBIDDEN_ROLE`
    for a spectator on every mutating action; `NOT_CAPTAIN` for a non-captain and for the
    inactive team's captain; `NO_ACTIVE_CLUE` / `NOT_YOUR_TURN` on selection attempts;
    `FORBIDDEN_ROLE` when a captain tries to select a card or call `end_turn`.
  - `reconnect.test.ts` (2 tests) — a disconnected player stays in `players[]` and is restored
    (team/role intact) on reconnect with the same `playerId`; a teammate can take over an
    abandoned captain slot, and the original captain is demoted to `operative` on reconnect.

Current total: **79 tests** (21 shared unit + 48 server unit + 10 server e2e), all passing.
