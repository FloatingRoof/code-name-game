import type { PublicGameState, TeamColor } from "@codenames/shared";
import { useSelectTeam } from "../api/use-select-team";
import "./team-select.css";

interface TeamSelectPageProps {
  gameState: PublicGameState;
  myPlayerId: string;
}

const TEAMS: { color: TeamColor; label: string; icon: string }[] = [
  { color: "red", label: "Red", icon: "🔥" },
  { color: "blue", label: "Blue", icon: "💧" },
];

export function TeamSelectPage({ gameState, myPlayerId }: TeamSelectPageProps) {
  const selectTeam = useSelectTeam();
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId);

  return (
    <div className="team-select">
      <div className="team-select__header">
        <div className="team-select__logo" aria-hidden="true">
          🕵️‍♂️
        </div>
        <h1 className="team-select__title">Choose your team</h1>
      </div>
      <div className="team-select__teams">
        {TEAMS.map(({ color, label, icon }) => {
          const members = gameState.players.filter((p) => p.team === color);
          const isMine = myPlayer?.team === color;

          return (
            <div key={color} className={`team-select__card team-select__card--${color}`}>
              <div className="team-select__icon" aria-hidden="true">
                {icon}
              </div>
              <h2 className="team-select__team-name">{label} team</h2>
              <p className="team-select__count">
                {members.length} agent{members.length === 1 ? "" : "s"}
              </p>
              <ul className="team-select__members">
                {members.map((player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`team-select__join team-select__join--${color}`}
                disabled={isMine || selectTeam.isPending}
                onClick={() => selectTeam.mutate({ team: color })}
              >
                {isMine ? "Joined" : `Join ${label}`}
              </button>
            </div>
          );
        })}
      </div>
      {selectTeam.isError && <p className="team-select__error">{selectTeam.error.message}</p>}
    </div>
  );
}
