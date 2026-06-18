import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: prefersDark }) as unknown as typeof window.matchMedia,
  );
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it("falls back to the system preference when nothing is stored", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("dark");
  });

  it("prefers a stored theme over the system preference", () => {
    mockMatchMedia(true);
    localStorage.setItem("codenames-theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("light");
  });

  it("applies the theme to the document and persists it", () => {
    mockMatchMedia(false);
    renderHook(() => useTheme());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("codenames-theme")).toBe("light");
  });

  it("toggles between light and dark", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]());
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => result.current[1]());
    expect(result.current[0]).toBe("light");
  });
});
