import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckResponse } from "@codenames/shared";
import { useEndTurn } from "./use-end-turn";

const { fakeSocket, clearSocketError } = vi.hoisted(() => ({
  fakeSocket: {
    emitWithAck: vi.fn<(event: string) => Promise<AckResponse<void>>>(),
  },
  clearSocketError: vi.fn(),
}));

vi.mock("../../../shared/socket", () => ({
  socket: fakeSocket,
  useClearSocketError: () => clearSocketError,
}));

function renderUseEndTurn() {
  const queryClient = new QueryClient();
  return renderHook(() => useEndTurn(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useEndTurn", () => {
  beforeEach(() => {
    clearSocketError.mockClear();
  });

  it("resolves on success", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseEndTurn();
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("end_turn");
    expect(clearSocketError).toHaveBeenCalledTimes(1);
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "NO_ACTIVE_CLUE", message: "No active clue to end" },
    });

    const { result } = renderUseEndTurn();
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No active clue to end");
  });
});
