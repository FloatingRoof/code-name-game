import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ServerEvent, type GameStateUpdatePayload } from "@codenames/shared";
import { socket } from "./socket";
import { GAME_STATE_QUERY_KEY } from "./gameStateQuery";

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleGameStateUpdate(payload: GameStateUpdatePayload) {
      queryClient.setQueryData(GAME_STATE_QUERY_KEY, payload);
    }

    socket.on(ServerEvent.GameStateUpdate, handleGameStateUpdate);
    socket.connect();

    return () => {
      socket.off(ServerEvent.GameStateUpdate, handleGameStateUpdate);
      socket.disconnect();
    };
  }, [queryClient]);

  return <>{children}</>;
}
