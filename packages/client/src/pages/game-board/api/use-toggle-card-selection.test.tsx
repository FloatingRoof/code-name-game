import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckResponse } from "@codenames/shared";
import { useToggleCardSelection } from "./use-toggle-card-selection";

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

function renderUseToggleCardSelection() {
  const queryClient = new QueryClient();
  return renderHook(() => useToggleCardSelection(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useToggleCardSelection", () => {
  beforeEach(() => {
    clearSocketError.mockClear();
  });

  it("resolves on success", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseToggleCardSelection();
    act(() => result.current.mutate({ cardId: 3 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("toggle_card_selection", { cardId: 3 });
    expect(clearSocketError).toHaveBeenCalledTimes(1);
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN_ROLE", message: "Captains cannot select cards" },
    });

    const { result } = renderUseToggleCardSelection();
    act(() => result.current.mutate({ cardId: 3 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Captains cannot select cards");
  });
});
