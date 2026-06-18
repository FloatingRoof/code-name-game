import { useMutation } from "@tanstack/react-query";
import type { SelectTeamPayload } from "@codenames/shared";
import { socket } from "../../../shared/socket";

export function useSelectTeam() {
  return useMutation({
    mutationFn: async (payload: SelectTeamPayload): Promise<void> => {
      const response = await socket.emitWithAck("select_team", payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? "Failed to select team");
      }
    },
  });
}
