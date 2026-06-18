import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AckResponse } from "@codenames/shared";
import { useSelectTeam } from "./use-select-team";

const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: {
    emitWithAck: vi.fn<(event: string, payload: unknown) => Promise<AckResponse<void>>>(),
  },
}));

vi.mock("../../../shared/socket", () => ({ socket: fakeSocket }));

function renderUseSelectTeam() {
  const queryClient = new QueryClient();
  return renderHook(() => useSelectTeam(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useSelectTeam", () => {
  it("resolves on success", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ ok: true });

    const { result } = renderUseSelectTeam();
    act(() => result.current.mutate({ team: "red" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith("select_team", { team: "red" });
  });

  it("throws the server error message on failure", async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN_ROLE", message: "Spectators cannot select a team" },
    });

    const { result } = renderUseSelectTeam();
    act(() => result.current.mutate({ team: "blue" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Spectators cannot select a team");
  });
});
