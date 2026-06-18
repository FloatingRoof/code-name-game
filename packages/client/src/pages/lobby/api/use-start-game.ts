import { useMutation } from "@tanstack/react-query";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useStartGame() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await socket.emitWithAck("start_game");
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to start game");
      }
    },
    onSettled: clearSocketError,
  });
}
