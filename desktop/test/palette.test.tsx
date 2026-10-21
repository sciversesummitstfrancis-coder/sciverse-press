import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CommandPalette } from "../src/CommandPalette";
import { AuthProvider } from "../src/ui";
import { vi as _vi } from "vitest";

// The palette fetches committees/articles/delegates in the background.
// Stub the module so the test never touches the network.
vi.mock("../src/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === "/committees")
      return [
        { id: "c1", name: "Security Council", abbreviation: "UNSC" },
        { id: "c2", name: "Health Organization", abbreviation: "WHO" },
      ];
    if (path === "/articles")
      return [{ id: "a1", title: "Opening statements filed", category: "Report" }];
    if (path === "/delegates") return { items: [{ id: "d1", name: "Asha Rao", publicId: "DEL-1" }] };
    return [];
  }),
  setToken: vi.fn(),
}));

function renderPalette() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<CommandPalette />} />
          <Route path="/committees/:id" element={<div>committee page</div>} />
          <Route path="/articles/:id" element={<div>article page</div>} />
          <Route path="/rankings/:id" element={<div>delegate page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const backdrop = () => document.querySelector(".cmdk-backdrop");

describe("command palette", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    document.body.innerHTML = "";
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens with the trigger button and closes again on click", async () => {
    renderPalette();
    const trigger = screen.getByLabelText("Open command palette");
    expect(backdrop()).toBeNull();

    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(backdrop()).not.toBeNull();

    // Clicking the backdrop closes it.
    await act(async () => {
      fireEvent.click(backdrop()!);
    });
    // The overlay is removed within a bounded time even if the exit
    // animation never runs (requestAnimationFrame is throttled in
    // background tabs).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(backdrop()).toBeNull();
  });

  it("opens with Ctrl+K and closes with Escape", async () => {
    renderPalette();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(backdrop()).not.toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(backdrop()).toBeNull();
  });

  it("filters results as you type", async () => {
    renderPalette();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Open command palette"));
    });
    // let the background fetch resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    const input = screen.getByLabelText("Command palette search");
    await act(async () => {
      fireEvent.change(input, { target: { value: "health" } });
    });
    const labels = [...document.querySelectorAll(".cmdk-item")].map((n) => n.textContent ?? "");
    expect(labels.some((l) => l.includes("Health Organization"))).toBe(true);
    expect(labels.some((l) => l.includes("Security Council"))).toBe(false);
  });

  it("navigates when a result is chosen", async () => {
    renderPalette();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Open command palette"));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    const item = [...document.querySelectorAll(".cmdk-item")].find((n) =>
      (n.textContent ?? "").includes("Security Council"),
    );
    expect(item).toBeTruthy();
    await act(async () => {
      fireEvent.click(item!);
    });
    expect(screen.getByText("committee page")).toBeTruthy();
  });
});
