import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JoinGameAck } from "@codenames/shared";
import { NameEntryPage } from "./NameEntryPage";

const mutate = vi.fn();
const joinGameState = {
  mutate,
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("../api/use-join-game", () => ({
  useJoinGame: () => joinGameState,
}));

describe("NameEntryPage", () => {
  beforeEach(() => {
    mutate.mockClear();
    joinGameState.isPending = false;
    joinGameState.isError = false;
    joinGameState.error = null;
  });

  it("disables submit until a name is entered", async () => {
    const user = userEvent.setup();
    render(<NameEntryPage onJoined={vi.fn()} />);

    const submit = screen.getByRole("button", { name: /join game/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/name/i), "Alice");
    expect(submit).toBeEnabled();
  });

  it("submits the trimmed name and spectator flag", async () => {
    const user = userEvent.setup();
    render(<NameEntryPage onJoined={vi.fn()} />);

    await user.type(screen.getByLabelText(/name/i), "  Alice  ");
    await user.click(screen.getByLabelText(/join as spectator/i));
    await user.click(screen.getByRole("button", { name: /join game/i }));

    expect(mutate).toHaveBeenCalledWith(
      { playerName: "Alice", asSpectator: true },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("calls onJoined when the mutation succeeds", async () => {
    const user = userEvent.setup();
    const onJoined = vi.fn();
    render(<NameEntryPage onJoined={onJoined} />);

    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /join game/i }));

    const ack: JoinGameAck = { playerId: "p1", roomCode: "MAIN" };
    const lastCall = mutate.mock.calls.at(-1)!;
    lastCall[1].onSuccess(ack);
    expect(onJoined).toHaveBeenCalledWith(ack);
  });

  it("shows the mutation error message", () => {
    joinGameState.isError = true;
    joinGameState.error = new Error("Player name is required");
    render(<NameEntryPage onJoined={vi.fn()} />);

    expect(screen.getByText("Player name is required")).toBeInTheDocument();
  });
});
