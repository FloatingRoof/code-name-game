import { useEffect, useState } from "react";
import type { CardColor } from "@codenames/shared";
import { useGameState } from "../../../shared/socket";
import { useConfirmGuess } from "../api/use-confirm-guess";
import { useEndTurn } from "../api/use-end-turn";
import { useSubmitClue } from "../api/use-submit-clue";
import { useToggleCardSelection } from "../api/use-toggle-card-selection";
import "./game-board.css";

interface GameBoardPageProps {
  myPlayerId: string;
}

const TEAM_LABEL: Record<"red" | "blue", string> = { red: "Red", blue: "Blue" };
const MOBILE_QUERY = "(max-width: 600px)";
const MOBILE_COLUMNS = 3;
const DESKTOP_COLUMNS = 5;

function cardClassName(color: CardColor | null, revealed: boolean, isCaptain: boolean): string {
  if (revealed) return `game-board__card game-board__card--revealed-${color}`;
  if (isCaptain && color) return `game-board__card game-board__card--hint-${color}`;
  return "game-board__card";
}

function useGridColumns(): number {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
}

export function GameBoardPage({ myPlayerId }: GameBoardPageProps) {
  const { data: gameState } = useGameState();
  const submitClue = useSubmitClue();
  const toggleCardSelection = useToggleCardSelection();
  const confirmGuess = useConfirmGuess();
  const endTurn = useEndTurn();
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState(1);
  const gridColumns = useGridColumns();

  if (!gameState) return null;

  const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
  if (!myPlayer) return null;

  const isCaptain = myPlayer.role === "captain";
  const isSpectator = myPlayer.role === "spectator";
  const isMyTeamTurn = !isSpectator && myPlayer.team === gameState.turn;
  const isInProgress = gameState.phase === "in_progress";
  const isOperativeTurn =
    !isCaptain && !isSpectator && isMyTeamTurn && isInProgress && Boolean(gameState.currentClue);

  const canSubmitClue = isCaptain && isMyTeamTurn && isInProgress && !gameState.currentClue;
  const canSelect = isOperativeTurn;
  const hasSelection = gameState.selectedCardIds.length > 0;
  const canConfirmGuess = isOperativeTurn && hasSelection;
  const guessesUsed = gameState.currentClue?.guessesUsed ?? 0;
  const canEndTurn = isOperativeTurn;

  const mutationError =
    submitClue.error ?? toggleCardSelection.error ?? confirmGuess.error ?? endTurn.error;
  const fillerCount = (gridColumns - (gameState.cards.length % gridColumns)) % gridColumns;

  function handleSubmitClue(e: React.FormEvent) {
    e.preventDefault();
    const word = clueWord.trim();
    if (!word) return;
    submitClue.mutate({ word, number: clueNumber }, { onSuccess: () => setClueWord("") });
  }

  return (
    <div className="game-board">
      <div className="game-board__header">
        <p className="game-board__room">Room {gameState.roomCode}</p>
        <div className="game-board__scores">
          <span className="game-board__score game-board__score--red">
            {gameState.teams.red.remaining}
          </span>
          <span
            className={`game-board__turn game-board__turn--${gameState.turn}`}
            aria-live="polite"
          >
            {gameState.phase === "finished"
              ? "Mission complete"
              : `${TEAM_LABEL[gameState.turn]} team's turn`}
          </span>
          <span className="game-board__score game-board__score--blue">
            {gameState.teams.blue.remaining}
          </span>
        </div>

        {myPlayer.team && (
          <div className={`game-board__my-badge game-board__my-badge--${myPlayer.team}`}>
            {isCaptain ? "♛" : "●"}&nbsp;
            {TEAM_LABEL[myPlayer.team]} team &mdash; {isCaptain ? "Captain" : isSpectator ? "Spectator" : "Operative"}
          </div>
        )}

      </div>

      {gameState.phase === "finished" && gameState.winner && (
        <p className="game-board__banner" role="status">
          {TEAM_LABEL[gameState.winner]} team wins
          {gameState.winReason === "assassin_revealed" ? " — assassin revealed!" : "!"}
        </p>
      )}

      <div className="game-board__clue">
        {gameState.currentClue ? (
          <p className="game-board__clue-active">
            Clue: <strong>{gameState.currentClue.word}</strong> ({gameState.currentClue.number}) —{" "}
            {gameState.currentClue.guessesRemaining} guess
            {gameState.currentClue.guessesRemaining === 1 ? "" : "es"} left
          </p>
        ) : (
          isCaptain &&
          isInProgress && (
            <p className="game-board__clue-waiting">
              {isMyTeamTurn ? "Give your team a clue" : "Waiting for the active captain's clue"}
            </p>
          )
        )}
        {isOperativeTurn && (
          <p className="game-board__clue-waiting">
            {hasSelection
              ? "Card picked — confirm to reveal it"
              : guessesUsed > 0
                ? "Pick another card, or end your turn"
                : "Pick a card to guess — your team must guess at least once"}
          </p>
        )}

        {canSubmitClue && (
          <form className="game-board__clue-form" onSubmit={handleSubmitClue}>
            <input
              type="text"
              className="game-board__clue-input"
              placeholder="Clue word"
              value={clueWord}
              onChange={(e) => setClueWord(e.target.value)}
              disabled={submitClue.isPending}
            />
            <input
              type="number"
              className="game-board__clue-number"
              min={0}
              value={clueNumber}
              onChange={(e) => setClueNumber(Math.max(0, Number(e.target.value)))}
              disabled={submitClue.isPending}
            />
            <button
              type="submit"
              className="game-board__button"
              disabled={submitClue.isPending || !clueWord.trim()}
            >
              Submit clue
            </button>
          </form>
        )}
      </div>

      <div className="game-board__grid">
        {gameState.cards.map((card) => {
          const isSelected = gameState.selectedCardIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`${cardClassName(card.color, card.revealed, isCaptain)}${
                canSelect && !card.revealed && myPlayer.team
                  ? ` game-board__card--hoverable-${myPlayer.team}`
                  : ""
              }${isSelected ? " game-board__card--selected" : ""}`}
              disabled={!canSelect || card.revealed || toggleCardSelection.isPending}
              onClick={() => toggleCardSelection.mutate({ cardId: card.id })}
            >
              {card.word}
            </button>
          );
        })}
        {Array.from({ length: fillerCount }, (_, index) => (
          <div key={`filler-${index}`} className="game-board__card game-board__card--filler" />
        ))}
      </div>

      {(canConfirmGuess || canEndTurn) && (
        <div className="game-board__actions">
          {canConfirmGuess && (
            <button
              type="button"
              className="game-board__button game-board__button--confirm"
              disabled={confirmGuess.isPending}
              onClick={() => confirmGuess.mutate()}
            >
              Confirm guess
            </button>
          )}
          {canEndTurn && (
            <button
              type="button"
              className="game-board__button game-board__button--end-turn"
              disabled={endTurn.isPending || guessesUsed < 1 || hasSelection}
              onClick={() => endTurn.mutate()}
            >
              End turn
            </button>
          )}
        </div>
      )}

      {mutationError && <p className="game-board__error">{mutationError.message}</p>}
    </div>
  );
}
