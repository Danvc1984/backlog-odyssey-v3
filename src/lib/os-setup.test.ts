import { describe, expect, it } from "vitest";

import {
  buildOsSetupConsequenceSummary,
  deriveWindowsFallbackExists,
  isTrivialPath,
  linuxTargetsExist,
  osSetupSchema,
} from "./os-setup";

const setup = (overrides: Partial<Parameters<typeof osSetupSchema.parse>[0]> = {}) => ({
  primaryOs: "LINUX" as const,
  hasWindowsFallback: false,
  handheldOs: "NONE" as const,
  onboardingCompleted: false,
  ...overrides,
});

describe("os setup contract", () => {
  it("derives Linux targets and Windows fallback from the selected setup", () => {
    expect(linuxTargetsExist(setup())).toBe(true);
    expect(deriveWindowsFallbackExists(setup({ hasWindowsFallback: true }))).toBe(true);
    expect(deriveWindowsFallbackExists(setup({ primaryOs: "WINDOWS", hasWindowsFallback: false }))).toBe(false);
  });

  it("identifies the all-Windows trivial path", () => {
    expect(isTrivialPath(setup({ primaryOs: "WINDOWS", handheldOs: "NONE" }))).toBe(true);
    expect(isTrivialPath(setup({ primaryOs: "WINDOWS", handheldOs: "WINDOWS" }))).toBe(true);
    expect(isTrivialPath(setup({ primaryOs: "WINDOWS", handheldOs: "LINUX" }))).toBe(false);
  });

  it("rejects a fallback on a Windows primary", () => {
    expect(() => osSetupSchema.parse(setup({ primaryOs: "WINDOWS", hasWindowsFallback: true }))).toThrow();
  });

  it("builds consequences for Linux and all-Windows setups", () => {
    expect(buildOsSetupConsequenceSummary(setup({ hasWindowsFallback: true }))).toEqual({
      compatibility: "Compatibility will be re-derived from stored Linux evidence.",
      recommendations: "Recommendation runs will be regenerated with Windows fallback available.",
    });
    expect(buildOsSetupConsequenceSummary(setup({ primaryOs: "WINDOWS" }))).toEqual({
      compatibility: "Compatibility will be inactive because this setup has no Linux device.",
      recommendations: "Recommendation runs will be regenerated for the selected devices.",
    });
  });
});
