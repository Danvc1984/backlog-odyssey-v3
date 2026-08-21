import { describe, expect, it } from "vitest";
import { parseSteamAppIdInput } from "./steam-identity";

describe("parseSteamAppIdInput", () => {
  it("accepts bare numeric App IDs", () => {
    expect(parseSteamAppIdInput("620")).toEqual({ ok: true, appId: "620" });
    expect(parseSteamAppIdInput("  1091500  ")).toEqual({
      ok: true,
      appId: "1091500",
    });
  });

  it("accepts store URLs in common shapes", () => {
    const cases = [
      "https://store.steampowered.com/app/620/Portal_2/",
      "https://store.steampowered.com/app/620",
      "store.steampowered.com/app/620/Portal_2/",
      "http://www.store.steampowered.com/app/620/",
      "https://store.steampowered.com/app/620/?snr=1_5_9__300",
      "https://store.steampowered.com/app/620#tab_all",
    ];
    for (const input of cases) {
      expect(parseSteamAppIdInput(input)).toEqual({ ok: true, appId: "620" });
    }
  });

  it("rejects empty and whitespace input", () => {
    expect(parseSteamAppIdInput("")).toMatchObject({ ok: false });
    expect(parseSteamAppIdInput("   ")).toMatchObject({ ok: false });
  });

  it("rejects non-numeric garbage", () => {
    expect(parseSteamAppIdInput("Portal 2")).toMatchObject({ ok: false });
    expect(parseSteamAppIdInput("62O")).toMatchObject({ ok: false });
    expect(parseSteamAppIdInput("620abc")).toMatchObject({ ok: false });
  });

  it("rejects zero and negative-looking IDs", () => {
    expect(parseSteamAppIdInput("0")).toMatchObject({ ok: false });
    expect(parseSteamAppIdInput("-620")).toMatchObject({ ok: false });
  });

  it("rejects absurdly long digit strings", () => {
    expect(parseSteamAppIdInput("12345678901")).toMatchObject({ ok: false });
  });

  it("rejects Steam pages that are not app pages", () => {
    const cases = [
      "https://store.steampowered.com/",
      "https://store.steampowered.com/explore/",
      "https://steamcommunity.com/app/620",
      "https://store.steampowered.com/bundle/1234",
    ];
    for (const input of cases) {
      expect(parseSteamAppIdInput(input)).toMatchObject({ ok: false });
    }
  });
});
