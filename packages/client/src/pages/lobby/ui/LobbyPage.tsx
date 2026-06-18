import { useEffect } from "react";
import type { Player, PublicGameState, TeamColor } from "@codenames/shared";
import { useGameState } from "../../../shared/socket";
import { useBecomeCaptain } from "../api/use-become-captain";
import { usePlayerReady } from "../api/use-player-ready";
import { useStartGame } from "../api/use-start-game";
import { useStepDownCaptain } from "../api/use-step-down-captain";
import "./lobby.css";

interface LobbyPageProps {
  myPlayerId: string;
}

const TEAMS: { color: TeamColor; label: string }[] = [
  { color: "red", label: "Red" },
  { color: "blue", label: "Blue" },
];

function canAutoStart(state: PublicGameState): boolean {
  const active = state.players.filter(
    (p) => p.role !== "spectator" && p.connected && p.team !== null,
  );
  const red = active.filter((p) => p.team === "red");
  const blue = active.filter((p) => p.team === "blue");

  if (red.length < state.minPlayersPerTeam || blue.length < state.minPlayersPerTeam) return false;
  if (!red.some((p) => p.role === "captain")) return false;
  if (!blue.some((p) => p.role === "captain")) return false;
  return active.every((p) => p.isReady);
}

function memberSuffix(player: Player, myPlayerId: string): string {
  const tags = [
    player.id === myPlayerId ? "(you)" : null,
    !player.connected ? "(disconnected)" : null,
  ].filter(Boolean);
  return tags.length > 0 ? ` ${tags.join(" ")}` : "";
}

export function LobbyPage({ myPlayerId }: LobbyPageProps) {
  const { data: gameState } = useGameState();
  const becomeCaptain = useBecomeCaptain();
  const stepDownCaptain = useStepDownCaptain();
  const playerReady = usePlayerReady();
  const startGame = useStartGame();

  const shouldAutoStart = Boolean(
    gameState && gameState.phase === "lobby" && canAutoStart(gameState),
  );

  const {
    mutate: triggerStartGame,
    reset: resetStartGame,
    isPending: startGamePending,
    isError: startGameFailed,
  } = startGame;

  // Clear a past failure once the auto-start condition no longer holds, so the
  // next time it becomes true (e.g. after a player readies up again) we retry
  // instead of staying stuck on a stale error.
  useEffect(() => {
    if (!shouldAutoStart) resetStartGame();
  }, [shouldAutoStart, resetStartGame]);

  useEffect(() => {
    if (shouldAutoStart && !startGamePending && !startGameFailed) {
      triggerStartGame();
    }
  }, [shouldAutoStart, startGamePending, startGameFailed, triggerStartGame]);

  if (!gameState) return null;

  const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
  if (!myPlayer) return null;

  const isSpectator = myPlayer.role === "spectator";
  const mutationError = becomeCaptain.error ?? stepDownCaptain.error ?? playerReady.error;

  return (
    <div className="lobby">
      <div className="lobby__header">
        <div className="lobby__logo" aria-hidden="true">
          ⏳
        </div>
        <h1 className="lobby__title">Mission lobby</h1>
        <p className="lobby__room">Room {gameState.roomCode}</p>
      </div>

      <div className="lobby__teams">
        {TEAMS.map(({ color, label }) => {
          const members = gameState.players.filter((p) => p.team === color);
          return (
            <div key={color} className={`lobby__team lobby__team--${color}`}>
              <h2 className="lobby__team-name">{label} team</h2>
              <ul className="lobby__members">
                {members.map((player) => (
                  <li key={player.id} className="lobby__member">
                    <span className="lobby__member-name">
                      <span className="lobby__crown" aria-hidden="true">
                        {player.role === "captain" ? "👑" : ""}
                      </span>
                      {player.name}
                      {memberSuffix(player, myPlayerId)}
                    </span>
                    <span className={player.isReady ? "lobby__ready" : "lobby__not-ready"}>
                      {player.isReady ? "Ready" : "Waiting"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {isSpectator ? (
        <p className="lobby__spectator-note">You are observing this mission.</p>
      ) : (
        <div className="lobby__controls">
          {myPlayer.role === "captain" ? (
            <button
              type="button"
              className="lobby__button"
              disabled={stepDownCaptain.isPending}
              onClick={() => myPlayer.team && stepDownCaptain.mutate({ team: myPlayer.team })}
            >
              Step down as captain
            </button>
          ) : (
            <button
              type="button"
              className="lobby__button"
              disabled={becomeCaptain.isPending || !myPlayer.team}
              onClick={() => myPlayer.team && becomeCaptain.mutate({ team: myPlayer.team })}
            >
              Become captain
            </button>
          )}
          <button
            type="button"
            className={`lobby__button lobby__button--ready ${
              myPlayer.isReady ? "lobby__button--ready-on" : "lobby__button--ready-off"
            }`}
            disabled={playerReady.isPending}
            onClick={() => playerReady.mutate({ ready: !myPlayer.isReady })}
          >
            {myPlayer.isReady ? "Not ready" : "Ready up"}
          </button>
        </div>
      )}

      {mutationError && <p className="lobby__error">{mutationError.message}</p>}
    </div>
  );
}
