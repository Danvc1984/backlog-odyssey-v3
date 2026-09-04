import { describe, expect, it } from "vitest";
import { externalUrl } from "@/lib/external-url";

describe("externalUrl", () => {
  it("returns the normalized URL for http and https", () => {
    expect(externalUrl("https://rawg.io/games/elden-ring")).toBe(
      "https://rawg.io/games/elden-ring",
    );
    expect(externalUrl("http://example.com/path")).toBe(
      "http://example.com/path",
    );
  });

  it("returns null for non-http/https protocols", () => {
    expect(externalUrl("ftp://example.com/file")).toBeNull();
    expect(externalUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(externalUrl("not a url")).toBeNull();
    expect(externalUrl("")).toBeNull();
    expect(externalUrl(null)).toBeNull();
  });
});
