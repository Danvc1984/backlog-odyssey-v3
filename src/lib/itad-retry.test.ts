import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestItad } from "./itad-api";

vi.mock("server-only", () => ({}));

describe("requestItad retry behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const url = "https://api.isthereanydeal.com/example";
  const init = { method: "POST" as const };

  it("returns the response immediately on success without delays", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const outcome = await requestItad(fetchMock, url, init);

    expect(outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient network failures with growing backoff and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const pending = requestItad(fetchMock, url, init);

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await pending;

    expect(outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("waits for Retry-After seconds on a 429 instead of the default backoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "Retry-After": "7" } }),
      )
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const pending = requestItad(fetchMock, url, init);

    await vi.advanceTimersByTimeAsync(7000);
    const outcome = await pending;

    expect(outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to backoff when Retry-After is missing on a 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const pending = requestItad(fetchMock, url, init);

    await vi.advanceTimersByTimeAsync(500);
    const outcome = await pending;

    expect(outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts with the last typed error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const pending = requestItad(fetchMock, url, init);

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const outcome = await pending;

    expect(outcome).toEqual({
      ok: false,
      error: { category: "NETWORK", message: "ITAD could not be reached" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry client errors such as auth failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("denied", { status: 403 }));

    const outcome = await requestItad(fetchMock, url, init);

    expect(outcome).toMatchObject({ ok: true });
    expect((outcome as { response: Response }).response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries server errors but reports them once attempts are exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 503 }));
    const pending = requestItad(fetchMock, url, init);

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const outcome = await pending;

    expect(outcome).toMatchObject({ ok: false, error: { category: "HTTP", status: 503 } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
