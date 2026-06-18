import { useState, type FormEvent } from "react";
import type { JoinGameAck } from "@codenames/shared";
import { useJoinGame } from "../api/use-join-game";
import "./name-entry.css";

interface NameEntryPageProps {
  onJoined: (session: JoinGameAck) => void;
}

export function NameEntryPage({ onJoined }: NameEntryPageProps) {
  const [name, setName] = useState("");
  const [asSpectator, setAsSpectator] = useState(false);
  const joinGame = useJoinGame();

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !joinGame.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    joinGame.mutate({ playerName: trimmedName, asSpectator }, { onSuccess: onJoined });
  }

  return (
    <div className="name-entry">
      <form className="name-entry__card" onSubmit={handleSubmit}>
        <div className="name-entry__logo" aria-hidden="true">
          🕵️‍♂️
        </div>
        <h1 className="name-entry__title">Codenames</h1>
        <p className="name-entry__subtitle">Enter your name to join the game</p>

        <label className="name-entry__label" htmlFor="player-name">
          Name
        </label>
        <input
          id="player-name"
          className="name-entry__input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          maxLength={32}
          autoFocus
        />

        <label className="name-entry__checkbox">
          <input
            type="checkbox"
            checked={asSpectator}
            onChange={(event) => setAsSpectator(event.target.checked)}
          />
          Join as spectator
        </label>

        {joinGame.isError && <p className="name-entry__error">{joinGame.error.message}</p>}

        <button className="name-entry__submit" type="submit" disabled={!canSubmit}>
          {joinGame.isPending ? "Joining…" : "Join game"}
        </button>
      </form>
    </div>
  );
}
