import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLimiter() {
  vi.resetModules();
  return import("./igdb-rate-limit");
}

describe("IGDB rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at most four requests in each rolling second", async () => {
    vi.useFakeTimers();
    const { acquireIgdbRateLimit } = await loadLimiter();
    const releases = await Promise.all(
      Array.from({ length: 4 }, () => acquireIgdbRateLimit()),
    );
    let fifthStarted = false;
    const fifth = acquireIgdbRateLimit().then((release) => {
      fifthStarted = true;
      return release;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(fifthStarted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fifthStarted).toBe(true);

    releases.forEach((release) => release());
    (await fifth)();
  });

  it("keeps no more than eight requests in flight", async () => {
    vi.useFakeTimers();
    const { acquireIgdbRateLimit } = await loadLimiter();
    const releases: Array<() => void> = [];
    let started = 0;
    const waiters = Array.from({ length: 9 }, () =>
      acquireIgdbRateLimit().then((release) => {
        started += 1;
        releases.push(release);
      }),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toBe(4);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toBe(8);

    releases.slice(0, 4).forEach((release) => release());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toBe(9);
    releases.slice(4).forEach((release) => release());
    await Promise.all(waiters);
  });

  it("serves waiters in FIFO order", async () => {
    vi.useFakeTimers();
    const { acquireIgdbRateLimit } = await loadLimiter();
    const order: number[] = [];
    const waiters = Array.from({ length: 5 }, (_, index) =>
      acquireIgdbRateLimit().then((release) => {
        order.push(index);
        return release;
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    (await Promise.all(waiters)).forEach((release) => release());
  });

  it("releases capacity after both resolve and reject paths", async () => {
    vi.useFakeTimers();
    const { withIgdbRateLimit } = await loadLimiter();
    let resolvedStarted = false;
    const resolved = withIgdbRateLimit(async () => {
      resolvedStarted = true;
      return "ok";
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolvedStarted).toBe(true);
    await expect(resolved).resolves.toBe("ok");

    let rejectedStarted = false;
    const rejected = withIgdbRateLimit(async () => {
      rejectedStarted = true;
      throw new Error("request failed");
    });
    const rejectionAssertion = expect(rejected).rejects.toThrow("request failed");
    await vi.advanceTimersByTimeAsync(0);
    expect(rejectedStarted).toBe(true);
    await rejectionAssertion;

    let afterRejectStarted = false;
    const afterReject = withIgdbRateLimit(async () => {
      afterRejectStarted = true;
      return "recovered";
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(afterRejectStarted).toBe(true);
    await expect(afterReject).resolves.toBe("recovered");
  });
});
