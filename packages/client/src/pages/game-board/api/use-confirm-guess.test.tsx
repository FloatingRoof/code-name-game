import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckResponse } from "@codenames/shared";
import { useConfirmGuess } from "./use-confirm-guess";

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

function renderUseConfirmGuess() {
  const queryClient = new QueryClient();
  return renderHook(() => useConfirmGuess(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useConfirmGuess", () => {
  beforeEach(() => {
    clearSocketError.mockClear();
  });

  it("resolves on success", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseConfirmGuess();
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("confirm_guess");
    expect(clearSocketError).toHaveBeenCalledTimes(1);
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "NO_CARD_SELECTED", message: "Select a card before confirming" },
    });

    const { result } = renderUseConfirmGuess();
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Select a card before confirming");
  });
});
