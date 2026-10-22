import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { useFetch } from "../src/ui";

const apiFetch = vi.fn();
vi.mock("../src/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

function Probe({ path, deps = [] as unknown[], timeout = 15000 }: { path: string | null; deps?: unknown[]; timeout?: number }) {
  const { data, error, loading } = useFetch<{ v: number }>(path, deps, timeout);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="data">{data ? JSON.stringify(data) : ""}</span>
    </div>
  );
}

describe("useFetch stability", () => {
  beforeEach(() => {
    cleanup();
    apiFetch.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("discards a slow stale response instead of overwriting a newer one", async () => {
    // First request resolves slowly, second resolves fast.
    let resolveFirst: (v: unknown) => void = () => {};
    apiFetch
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => Promise.resolve({ v: 2 }));

    const { rerender } = render(<Probe path="/a" />);
    // Re-run with a different path -> a second request starts.
    await act(async () => { rerender(<Probe path="/b" />); });
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe('{"v":2}'));

    // Now the stale first request finally lands - it must be ignored.
    await act(async () => { resolveFirst({ v: 1 }); await Promise.resolve(); });
    expect(screen.getByTestId("data").textContent).toBe('{"v":2}');
  });

  it("reports an error instead of hanging forever when the request times out", async () => {
    apiFetch.mockImplementation((_p: string, init?: RequestInit) => {
      // Never resolve; the AbortSignal is what the caller must honour.
      return new Promise((_r, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    });

    render(<Probe path="/slow" timeout={400} />);
    await waitFor(
      () => expect(screen.getByTestId("error").textContent).toMatch(/timed out/i),
      { timeout: 4000 },
    );
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("does not fetch when the path is null", async () => {
    render(<Probe path={null} />);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
