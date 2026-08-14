import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { isAllowedEmail } from "./auth-guard";

describe("isAllowedEmail", () => {
  beforeEach(() => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "owner@example.com");
  });

  it("returns true for the allowed email", () => {
    expect(isAllowedEmail("owner@example.com")).toBe(true);
  });

  it("returns false for a different email", () => {
    expect(isAllowedEmail("other@example.com")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAllowedEmail(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAllowedEmail(undefined)).toBe(false);
  });

  it("returns false when env var is unset", () => {
    vi.stubEnv("ALLOWED_GOOGLE_EMAIL", "");
    expect(isAllowedEmail("owner@example.com")).toBe(false);
  });
});
