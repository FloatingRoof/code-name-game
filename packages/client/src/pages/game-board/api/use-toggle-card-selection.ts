import { useMutation } from "@tanstack/react-query";
import type { ToggleCardSelectionPayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

export function useToggleCardSelection() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: ToggleCardSelectionPayload): Promise<void> => {
      const response = await socket.emitWithAck("toggle_card_selection", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to select card");
      }
    },
    onSettled: clearSocketError,
  });
}
