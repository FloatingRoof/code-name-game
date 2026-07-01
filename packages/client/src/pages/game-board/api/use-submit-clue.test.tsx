import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckResponse } from "@codenames/shared";
import { useSubmitClue } from "./use-submit-clue";

const { fakeSocket, clearSocketError } = vi.hoisted(() => ({
  fakeSocket: {
    emitWithAck: vi.fn<(event: string, payload: unknown) => Promise<AckResponse<void>>>(),
  },
  clearSocketError: vi.fn(),
}));

vi.mock("../../../shared/socket", () => ({
  socket: fakeSocket,
  useClearSocketError: () => clearSocketError,
}));

function renderUseSubmitClue() {
  const queryClient = new QueryClient();
  return renderHook(() => useSubmitClue(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useSubmitClue", () => {
  beforeEach(() => {
    clearSocketError.mockClear();
  });

  it("resolves on success", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseSubmitClue();
    act(() => result.current.mutate({ word: "OCEAN", number: 2 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("submit_clue", {
      word: "OCEAN",
      number: 2,
    });
    expect(clearSocketError).toHaveBeenCalledTimes(1);
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "NOT_CAPTAIN", message: "Only the active captain can give a clue" },
    });

    const { result } = renderUseSubmitClue();
    act(() => result.current.mutate({ word: "OCEAN", number: 2 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Only the active captain can give a clue");
  });
});
