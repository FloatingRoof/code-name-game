import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ServerEvent, type ErrorPayload, type GameStateUpdatePayload } from "@codenames/shared";
import { socket } from "./socket";
import { GAME_STATE_QUERY_KEY } from "./gameStateQuery";
import { SOCKET_ERROR_QUERY_KEY } from "./socketErrorQuery";

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleGameStateUpdate(payload: GameStateUpdatePayload) {
      queryClient.setQueryData(GAME_STATE_QUERY_KEY, payload);
    }

    function handleError(payload: ErrorPayload) {
      queryClient.setQueryData(SOCKET_ERROR_QUERY_KEY, payload);
    }

    socket.on(ServerEvent.GameStateUpdate, handleGameStateUpdate);
    socket.on(ServerEvent.Error, handleError);
    socket.connect();

    return () => {
      socket.off(ServerEvent.GameStateUpdate, handleGameStateUpdate);
      socket.off(ServerEvent.Error, handleError);
      socket.disconnect();
    };
  }, [queryClient]);

  return <>{children}</>;
}
