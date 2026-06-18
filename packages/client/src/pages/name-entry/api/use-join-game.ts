import { useMutation } from "@tanstack/react-query";
import type { JoinGameAck, JoinGamePayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useJoinGame() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: JoinGamePayload): Promise<JoinGameAck> => {
      const response = await socket.emitWithAck("join_game", payload);
      if (!response.ok || !response.data) {
        throw new Error(response.error?.message ?? "Failed to join game");
      }
      return response.data;
    },
    onSettled: clearSocketError,
  });
}
