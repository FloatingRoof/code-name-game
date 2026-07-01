import { useMutation } from "@tanstack/react-query";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useConfirmGuess() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await socket.emitWithAck("confirm_guess");
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to confirm guess");
      }
    },
    onSettled: clearSocketError,
  });
}
