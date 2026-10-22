import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, isNetworkError, useMe } from "../src/ui";

const apiFetch = vi.fn();
vi.mock("../src/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

function Probe() {
  const { serverDown, me } = useMe();
  return (
    <div>
      <span data-testid="down">{String(serverDown)}</span>
      <span data-testid="me">{me ? me.email : ""}</span>
    </div>
  );
}

function renderApp() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("server reachability", () => {
  beforeEach(() => {
    cleanup();
    apiFetch.mockReset();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("recognises a network failure as 'server down', not a bad session", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("401: session expired"))).toBe(false);
    expect(isNetworkError(new Error("500: internal error"))).toBe(false);
  });

  it("flags the server as down when /me cannot be reached", async () => {
    localStorage.setItem("sp_token", "t");
    apiFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp();
    await waitFor(() => expect(screen.getByTestId("down").textContent).toBe("true"));
  });

  it("does not flag the server as down for an expired session", async () => {
    localStorage.setItem("sp_token", "t");
    apiFetch.mockRejectedValue(new Error("401: session expired"));
    renderApp();
    await waitFor(() => expect(screen.getByTestId("me").textContent).toBe(""));
    expect(screen.getByTestId("down").textContent).toBe("false");
  });

  it("probes /health on the login screen so a first-time visitor is warned", async () => {
    apiFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp();
    await waitFor(() => expect(screen.getByTestId("down").textContent).toBe("true"));
    expect(apiFetch).toHaveBeenCalledWith("/health", {}, 6000);
  });

  it("clears the down flag once the server answers again", async () => {
    localStorage.setItem("sp_token", "t");
    apiFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ id: "u1", email: "a@t.local", name: "A", role: "admin" });

    let reload: () => void = () => {};
    function ReloadProbe() {
      reload = useMe().reload;
      return null;
    }
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
          <ReloadProbe />
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("down").textContent).toBe("true"));

    // Press "Try again" - the server is back.
    await act(async () => { reload(); });
    await waitFor(() => expect(screen.getByTestId("down").textContent).toBe("false"));
    expect(screen.getByTestId("me").textContent).toBe("a@t.local");
  });
});
