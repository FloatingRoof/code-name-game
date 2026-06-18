import { useMutation } from "@tanstack/react-query";
import type { BecomeCaptainPayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useBecomeCaptain() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: BecomeCaptainPayload): Promise<void> => {
      const response = await socket.emitWithAck("become_captain", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to become captain");
      }
    },
    onSettled: clearSocketError,
  });
}
