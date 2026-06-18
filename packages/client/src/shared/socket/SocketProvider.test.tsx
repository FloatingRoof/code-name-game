import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ErrorPayload, PublicGameState } from "@codenames/shared";
import { GAME_STATE_QUERY_KEY } from "./gameStateQuery";
import { SOCKET_ERROR_QUERY_KEY } from "./socketErrorQuery";
import { SocketProvider } from "./SocketProvider";

const { handlers, fakeSocket } = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {};
  return {
    handlers,
    fakeSocket: {
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
  };
});

vi.mock("./socket", () => ({ socket: fakeSocket }));

function renderWithClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <div>content</div>
      </SocketProvider>
    </QueryClientProvider>,
  );
}

describe("SocketProvider", () => {
  it("connects the socket and registers a game_state_update listener on mount", () => {
    const queryClient = new QueryClient();
    const { unmount } = renderWithClient(queryClient);

    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
    expect(fakeSocket.on).toHaveBeenCalledWith("game_state_update", expect.any(Function));
    expect(fakeSocket.on).toHaveBeenCalledWith("error", expect.any(Function));

    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(fakeSocket.off).toHaveBeenCalledWith("game_state_update", expect.any(Function));
    expect(fakeSocket.off).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("writes incoming game_state_update payloads into the query cache", () => {
    const queryClient = new QueryClient();
    renderWithClient(queryClient);

    const payload = { roomCode: "MAIN", phase: "lobby" } as unknown as PublicGameState;
    handlers["game_state_update"](payload);

    expect(queryClient.getQueryData(GAME_STATE_QUERY_KEY)).toEqual(payload);
  });

  it("writes incoming error payloads into the query cache", () => {
    const queryClient = new QueryClient();
    renderWithClient(queryClient);

    const payload: ErrorPayload = { code: "ROOM_NOT_FOUND", message: "Room not found" };
    handlers["error"](payload);

    expect(queryClient.getQueryData(SOCKET_ERROR_QUERY_KEY)).toEqual(payload);
  });
});
