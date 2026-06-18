import { useQuery } from "@tanstack/react-query";
import type { PublicGameState } from "@codenames/shared";

/** Cache key for the server-pushed game state. Never fetched directly — only seeded via setQueryData. */
export const GAME_STATE_QUERY_KEY = ["gameState"] as const;

export function useGameState() {
  return useQuery<PublicGameState | null>({
    queryKey: GAME_STATE_QUERY_KEY,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    initialData: null,
  });
}
