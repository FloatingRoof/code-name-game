import { useMutation } from "@tanstack/react-query";
import type { SubmitCluePayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useSubmitClue() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: SubmitCluePayload): Promise<void> => {
      const response = await socket.emitWithAck("submit_clue", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to submit clue");
      }
    },
    onSettled: clearSocketError,
  });
}
