import { useMutation } from "@tanstack/react-query";
import type { PlayerReadyPayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

export function usePlayerReady() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: PlayerReadyPayload): Promise<void> => {
      const response = await socket.emitWithAck("player_ready", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to update ready state");
      }
    },
    onSettled: clearSocketError,
  });
}
