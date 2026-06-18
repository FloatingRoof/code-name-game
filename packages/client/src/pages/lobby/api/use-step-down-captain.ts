import { useMutation } from "@tanstack/react-query";
import type { SelectTeamPayload } from "@codenames/shared";
import { socket, useClearSocketError } from "../../../shared/socket";

/** Stepping down re-selects the player's own team, which the server always resolves to "operative". */
export function useStepDownCaptain() {
  const clearSocketError = useClearSocketError();

  return useMutation({
    mutationFn: async (payload: SelectTeamPayload): Promise<void> => {
      const response = await socket.emitWithAck("select_team", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to step down as captain");
      }
    },
    onSettled: clearSocketError,
  });
}
