import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildSteamOpenIdUrl,
  extractSteamId64,
  verifySteamOpenIdResponse,
} from "./steam-openid";

describe("buildSteamOpenIdUrl", () => {
  it("points at the Steam OpenID login endpoint", () => {
    const url = buildSteamOpenIdUrl(
      "http://localhost:3500/api/steam/callback",
      "http://localhost:3500",
    );
    expect(url.startsWith("https://steamcommunity.com/openid/login?")).toBe(
      true,
    );
  });

  it("sets the OpenID 2.0 namespace and checkid_setup mode", () => {
    const url = new URL(
      buildSteamOpenIdUrl(
        "http://localhost:3500/api/steam/callback",
        "http://localhost:3500",
      ),
    );
    expect(url.searchParams.get("openid.ns")).toBe(
      "http://specs.openid.net/auth/2.0",
    );
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
  });

  it("uses return_to and realm separately", () => {
    const url = new URL(
      buildSteamOpenIdUrl(
        "http://localhost:3500/api/steam/callback",
        "http://localhost:3500",
      ),
    );
    expect(url.searchParams.get("openid.return_to")).toBe(
      "http://localhost:3500/api/steam/callback",
    );
    expect(url.searchParams.get("openid.realm")).toBe("http://localhost:3500");
  });

  it("uses identifier_select for identity and claimed_id", () => {
    const url = new URL(
      buildSteamOpenIdUrl(
        "http://localhost:3500/api/steam/callback",
        "http://localhost:3500",
      ),
    );
    expect(url.searchParams.get("openid.identity")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select",
    );
    expect(url.searchParams.get("openid.claimed_id")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select",
    );
  });
});

describe("extractSteamId64", () => {
  it("extracts a SteamID64 from a valid claimed_id", () => {
    const query = {
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198012345678",
    };
    expect(extractSteamId64(query)).toBe("76561198012345678");
  });

  it("returns null for a claimed_id without an id segment", () => {
    const query = {
      "openid.claimed_id": "https://steamcommunity.com/profile/someone",
    };
    expect(extractSteamId64(query)).toBeNull();
  });

  it("returns null when claimed_id is missing", () => {
    expect(extractSteamId64({})).toBeNull();
  });
});

describe("verifySteamOpenIdResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when Steam says is_valid:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("ns:http://specs.openid.net/auth/2.0\nis_valid:true"),
      }),
    );

    const result = await verifySteamOpenIdResponse({
      "openid.sig": "abc",
    });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://steamcommunity.com/openid/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("returns false when Steam says is_valid:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("ns:http://specs.openid.net/auth/2.0\nis_valid:false"),
      }),
    );

    const result = await verifySteamOpenIdResponse({
      "openid.sig": "abc",
    });

    expect(result).toBe(false);
  });

  it("returns false when the validation request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(""),
      }),
    );

    const result = await verifySteamOpenIdResponse({
      "openid.sig": "abc",
    });

    expect(result).toBe(false);
  });
});