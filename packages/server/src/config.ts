function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, got "${value}"`);
  }
  return parsed;
}

export const config = {
  port: parsePositiveInt(process.env.PORT, 3001, "PORT"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  minPlayersPerTeam: parsePositiveInt(process.env.MIN_PLAYERS_PER_TEAM, 2, "MIN_PLAYERS_PER_TEAM"),
  defaultRoomCode: process.env.DEFAULT_ROOM_CODE ?? "MAIN",
  disconnectRemovalMs: parsePositiveInt(
    process.env.DISCONNECT_REMOVAL_MS,
    15_000,
    "DISCONNECT_REMOVAL_MS",
  ),
};
