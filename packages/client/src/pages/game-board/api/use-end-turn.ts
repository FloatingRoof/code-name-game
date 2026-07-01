import { useMutation } from "@tanstack/react-query";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useEndTurn() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await socket.emitWithAck("end_turn");
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to end turn");
      }
    },
    onSettled: clearSocketError,
  });
}
