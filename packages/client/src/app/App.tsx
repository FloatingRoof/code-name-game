import { useState } from "react";
import type { JoinGameAck } from "@codenames/shared";
import { NameEntryPage } from "../pages/name-entry";
import { TeamSelectPage } from "../pages/team-select";
import { ThemeToggle, useTheme } from "../shared/theme";
import { useGameState, useSocketError } from "../shared/socket";
import { Providers } from "./providers/Providers";

function AppContent() {
  const [theme, toggleTheme] = useTheme();
  const [session, setSession] = useState<JoinGameAck | null>(null);
  const { data: gameState } = useGameState();
  const { data: socketError } = useSocketError();

  const myPlayer = gameState?.players.find((p) => p.id === session?.playerId);
  const needsTeam = Boolean(myPlayer && myPlayer.role !== "spectator" && myPlayer.team === null);

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {socketError && <p className="app__server-error">{socketError.message}</p>}
      {!session ? (
        <NameEntryPage onJoined={setSession} />
      ) : needsTeam && gameState ? (
        <TeamSelectPage myPlayerId={session.playerId} />
      ) : (
        <main>
          <p>
            Joined as player <strong>{session.playerId}</strong> in room{" "}
            <strong>{session.roomCode}</strong>.
          </p>
          <pre>{JSON.stringify(gameState, null, 2)}</pre>
        </main>
      )}
    </>
  );
}

export function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
