import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { awayGameUrl, clearAwayCache, lookupAway } from "./away-api";

const response = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), { status: 200, ...init });
const dataset = (status = "Supported") => [
  {
    name: "Portal 2",
    status,
    anticheats: ["Easy Anti-Cheat"],
    storeIds: { steam: "620" },
  },
];

describe("lookupAway", () => {
  beforeEach(() => clearAwayCache());

  it("matches a Steam App ID and caches the dataset for 24 hours", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(dataset()));

    await expect(lookupAway("620", fetchMock, 1_000)).resolves.toMatchObject({ status: "Supported" });
    await expect(lookupAway("missing", fetchMock, 1_000 + 60_000)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("builds the official AWAY game page URL from the Steam App ID", () => {
    expect(awayGameUrl("1517290")).toBe("https://areweanticheatyet.com/game/1517290");
  });

  it("ignores valid entries that have no Steam store ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([
      { name: "Fortnite", status: "Denied", anticheats: ["Easy Anti-Cheat"], storeIds: { epic: { slug: "fortnite" } } },
      ...dataset("Supported"),
    ]));

    await expect(lookupAway("620", fetchMock, 1_000)).resolves.toMatchObject({
      appId: "620",
      status: "Supported",
    });
  });

  it("refreshes stale data and preserves AWAY statuses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(dataset("Denied")))
      .mockResolvedValueOnce(response(dataset("Planned")));

    await expect(lookupAway("620", fetchMock, 1_000)).resolves.toMatchObject({ status: "Denied" });
    await expect(lookupAway("620", fetchMock, 1_000 + 24 * 60 * 60 * 1000)).resolves.toMatchObject({ status: "Planned" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("classifies network, HTTP, and malformed datasets", async () => {
    await expect(lookupAway("620", vi.fn().mockRejectedValue(new Error("offline"))))
      .resolves.toMatchObject({ category: "NETWORK" });
    await expect(lookupAway("620", vi.fn().mockResolvedValue(new Response("busy", { status: 503 }))))
      .resolves.toMatchObject({ category: "HTTP", status: 503 });
    await expect(lookupAway("620", vi.fn().mockResolvedValue(response({ broken: true }))))
      .resolves.toMatchObject({ category: "MALFORMED_RESPONSE" });
  });
});
