import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { isAllowedEmail } from "./auth-guard";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowedEmail", () => {
  it("accepts exactly the allowed email", () => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "owner@example.com");
    expect(isAllowedEmail("owner@example.com")).toBe(true);
  });

  it("rejects a different email, case-sensitively", () => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "owner@example.com");
    expect(isAllowedEmail("other@example.com")).toBe(false);
    expect(isAllowedEmail("Owner@example.com")).toBe(false);
  });

  it("rejects everything when the env var is unset", () => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "");
    expect(isAllowedEmail("owner@example.com")).toBe(false);
  });

  it("rejects missing or empty emails", () => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "owner@example.com");
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });
});
