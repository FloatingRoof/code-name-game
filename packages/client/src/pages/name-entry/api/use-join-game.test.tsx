import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckResponse, JoinGameAck } from "@codenames/shared";
import { useJoinGame } from "./use-join-game";

const { fakeSocket, clearSocketError } = vi.hoisted(() => ({
  fakeSocket: {
    emitWithAck: vi.fn<(event: string, payload: unknown) => Promise<AckResponse<JoinGameAck>>>(),
  },
  clearSocketError: vi.fn(),
}));

vi.mock("../../../shared/socket", () => ({
  socket: fakeSocket,
  useClearSocketError: () => clearSocketError,
}));

function renderUseJoinGame() {
  const queryClient = new QueryClient();
  return renderHook(() => useJoinGame(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useJoinGame", () => {
  beforeEach(() => {
    clearSocketError.mockClear();
  });

  it("resolves with the ack data on success", async () => {
    const ack: JoinGameAck = { playerId: "p1", roomCode: "MAIN" };
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true, data: ack });

    const { result } = renderUseJoinGame();
    act(() => result.current.mutate({ playerName: "Alice" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(ack);
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("join_game", { playerName: "Alice" });
    expect(clearSocketError).toHaveBeenCalledTimes(1);
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_NAME", message: "Player name is required" },
    });

    const { result } = renderUseJoinGame();
    act(() => result.current.mutate({ playerName: "" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Player name is required");
  });

  it("throws a fallback message when ok is true but data is missing", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseJoinGame();
    act(() => result.current.mutate({ playerName: "Alice" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to join game");
  });

  it("propagates a rejection when the socket emit itself fails", async () => {
    fakeSocket.emitWithAck.mockRejectedValue(new Error("transport closed"));

    const { result } = renderUseJoinGame();
    act(() => result.current.mutate({ playerName: "Alice" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("transport closed");
  });
});
