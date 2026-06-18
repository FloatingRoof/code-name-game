import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("offers to switch to dark mode while in light theme", () => {
    render(<ThemeToggle theme="light" onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("offers to switch to light mode while in dark theme", () => {
    render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
