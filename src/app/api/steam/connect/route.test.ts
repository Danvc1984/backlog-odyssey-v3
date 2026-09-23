import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/steam-openid", async () => {
  const actual = await vi.importActual<typeof import("@/lib/steam-openid")>("@/lib/steam-openid");
  return { ...actual, createStateNonce: vi.fn(() => "state-123") };
});

import { requireUser } from "@/lib/auth-guard";
import { GET } from "./route";

describe("Steam connect route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
  });

  it("stores the allowlisted Welcome intent alongside the nonce", async () => {
    const response = await GET(new Request(
      "http://localhost:3500/api/steam/connect?returnTo=welcome",
    ));

    expect(response.headers.get("location")).toContain("openid.return_to=");
    expect(response.cookies.get("steam-openid-state")?.value).toBe("state-123");
    expect(response.cookies.get("steam-openid-return-intent")?.value).toBe("welcome");
  });

  it("defaults invalid return intents to the existing Settings flow", async () => {
    const response = await GET(new Request(
      "http://localhost:3500/api/steam/connect?returnTo=https%3A%2F%2Fattacker.test",
    ));

    expect(response.cookies.get("steam-openid-return-intent")?.value).toBe("settings");
  });
});
