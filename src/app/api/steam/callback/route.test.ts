import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { steamConnection: { upsert: vi.fn() } },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/steam-openid", async () => {
  const actual = await vi.importActual<typeof import("@/lib/steam-openid")>("@/lib/steam-openid");
  return {
    ...actual,
    extractSteamId64: vi.fn(),
    verifySteamOpenIdResponse: vi.fn(),
  };
});

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { extractSteamId64, verifySteamOpenIdResponse } from "@/lib/steam-openid";
import { GET } from "./route";

const cookieValues = new Map<string, string>();

function setCookieValues(values: Record<string, string>) {
  cookieValues.clear();
  for (const [name, value] of Object.entries(values)) cookieValues.set(name, value);
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
  } as never);
}

function callbackRequest(query: string) {
  return new Request(`http://localhost:3500/api/steam/callback?${query}`);
}

describe("Steam callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCookieValues({
      "steam-openid-state": "state-123",
      "steam-openid-return-intent": "welcome",
    });
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(extractSteamId64).mockReturnValue("76561198012345678");
    vi.mocked(verifySteamOpenIdResponse).mockResolvedValue(true);
    vi.mocked(prisma.steamConnection.upsert).mockResolvedValue({} as never);
  });

  it("returns a successful Welcome connection to Welcome and clears temporary cookies", async () => {
    const response = await GET(callbackRequest(
      "state=state-123&openid.return_to=http%3A%2F%2Flocalhost%3A3500%2Fapi%2Fsteam%2Fcallback%3Fstate%3Dstate-123",
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/welcome?steam=connected",
    );
    expect(response.cookies.get("steam-openid-state")?.value).toBe("");
    expect(response.cookies.get("steam-openid-return-intent")?.value).toBe("");
    expect(prisma.steamConnection.upsert).toHaveBeenCalledTimes(1);
  });

  it("returns a provider cancellation to Welcome without linking an account", async () => {
    const response = await GET(callbackRequest("state=state-123&openid.mode=cancel"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/welcome?steam=cancelled",
    );
    expect(prisma.steamConnection.upsert).not.toHaveBeenCalled();
  });

  it("returns verification failures to Welcome with a short error status", async () => {
    vi.mocked(verifySteamOpenIdResponse).mockResolvedValue(false);

    const response = await GET(callbackRequest(
      "state=state-123&openid.return_to=http%3A%2F%2Flocalhost%3A3500%2Fapi%2Fsteam%2Fcallback%3Fstate%3Dstate-123",
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/welcome?steam=error",
    );
    expect(prisma.steamConnection.upsert).not.toHaveBeenCalled();
  });

  it("keeps a missing return intent on the existing Settings path", async () => {
    setCookieValues({ "steam-openid-state": "state-123" });

    const response = await GET(callbackRequest(
      "state=state-123&openid.return_to=http%3A%2F%2Flocalhost%3A3500%2Fapi%2Fsteam%2Fcallback%3Fstate%3Dstate-123",
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/settings?steam=connected",
    );
  });

  it("keeps an invalid return intent on the existing Settings path", async () => {
    setCookieValues({
      "steam-openid-state": "state-123",
      "steam-openid-return-intent": "https://attacker.test",
    });

    const response = await GET(callbackRequest(
      "state=state-123&openid.return_to=http%3A%2F%2Flocalhost%3A3500%2Fapi%2Fsteam%2Fcallback%3Fstate%3Dstate-123",
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/settings?steam=connected",
    );
  });

  it("returns callback errors to the allowlisted Welcome path", async () => {
    vi.mocked(prisma.steamConnection.upsert).mockRejectedValue(new Error("database unavailable"));

    const response = await GET(callbackRequest(
      "state=state-123&openid.return_to=http%3A%2F%2Flocalhost%3A3500%2Fapi%2Fsteam%2Fcallback%3Fstate%3Dstate-123",
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3500/welcome?steam=error",
    );
  });
});
