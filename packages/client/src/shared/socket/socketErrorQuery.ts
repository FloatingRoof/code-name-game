import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ErrorPayload } from "@codenames/shared";

/** Cache key for the latest server-pushed `error` event. Never fetched directly — only seeded via setQueryData. */
export const SOCKET_ERROR_QUERY_KEY = ["socketError"] as const;

export function useSocketError() {
  return useQuery<ErrorPayload | null>({
    queryKey: SOCKET_ERROR_QUERY_KEY,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    initialData: null,
  });
}

/**
 * Mutations resolve their own errors via ack and show them inline. Once a mutation settles
 * (success or failure), any stale global socket error is no longer relevant, so callers clear it
 * to avoid showing a leftover banner alongside (or instead of) the point-specific message.
 */
export function useClearSocketError() {
  const queryClient = useQueryClient();
  return () => queryClient.setQueryData(SOCKET_ERROR_QUERY_KEY, null);
}
