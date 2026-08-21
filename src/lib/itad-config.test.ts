import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getItadConfig } from "./itad-config";

describe("getItadConfig", () => {
  it("reports a clear configuration error without a key", () => {
    delete process.env.ITAD_API_KEY;

    const result = getItadConfig();

    expect(result).toEqual({
      ok: false,
      error: "ITAD is not configured: set ITAD_API_KEY in the environment",
    });
  });

  it("rejects a blank key the same as a missing one", () => {
    process.env.ITAD_API_KEY = "   ";

    const result = getItadConfig();

    expect(result).toMatchObject({ ok: false });
    delete process.env.ITAD_API_KEY;
  });

  it("returns a trimmed key when configured", () => {
    process.env.ITAD_API_KEY = "  test-key  ";

    const result = getItadConfig();

    expect(result).toEqual({ ok: true, config: { apiKey: "test-key" } });
    delete process.env.ITAD_API_KEY;
  });
});
