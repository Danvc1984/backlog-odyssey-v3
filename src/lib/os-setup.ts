import { z } from "zod";

export const primaryOsSchema = z.enum(["LINUX", "WINDOWS"]);
export const handheldOsSchema = z.enum(["NONE", "LINUX", "WINDOWS"]);
export const durationProfileSchema = z.enum(["HASTILY", "NORMALLY", "COMPLETELY"]);

export const osSetupSchema = z
  .object({
    primaryOs: primaryOsSchema,
    hasWindowsFallback: z.boolean(),
    handheldOs: handheldOsSchema,
    onboardingCompleted: z.boolean(),
    durationProfile: durationProfileSchema.optional(),
  })
  .strict()
  .superRefine((setup, context) => {
    if (setup.primaryOs === "WINDOWS" && setup.hasWindowsFallback) {
      context.addIssue({
        code: "custom",
        path: ["hasWindowsFallback"],
        message: "A Windows primary cannot have a Windows fallback",
      });
    }
  });

export type OsSetup = z.infer<typeof osSetupSchema>;

export interface OsSetupConsequenceSummary {
  compatibility: string;
  recommendations: string;
}

export function deriveWindowsFallbackExists(setup: Pick<OsSetup, "primaryOs" | "hasWindowsFallback">): boolean {
  return setup.primaryOs === "LINUX" && setup.hasWindowsFallback;
}

export function linuxTargetsExist(setup: Pick<OsSetup, "primaryOs" | "handheldOs">): boolean {
  return setup.primaryOs === "LINUX" || setup.handheldOs === "LINUX";
}

export function linuxDevicePhrase(setup: Pick<OsSetup, "primaryOs" | "handheldOs">): string {
  return setup.primaryOs === "WINDOWS" && setup.handheldOs === "LINUX"
    ? "your Linux handheld"
    : "Linux";
}

export function isCompatibilityActive(setup: Pick<OsSetup, "primaryOs" | "handheldOs">): boolean {
  return linuxTargetsExist(setup);
}

export function isTrivialPath(setup: Pick<OsSetup, "primaryOs" | "handheldOs">): boolean {
  return !linuxTargetsExist(setup);
}

export function buildOsSetupConsequenceSummary(
  setup: Pick<OsSetup, "primaryOs" | "hasWindowsFallback" | "handheldOs">,
): OsSetupConsequenceSummary {
  const hasLinuxTargets = linuxTargetsExist(setup);
  const fallbackExists = deriveWindowsFallbackExists(setup);

  return {
    compatibility: hasLinuxTargets
      ? "Compatibility will be re-derived from stored Linux evidence."
      : "Compatibility will be inactive because this setup has no Linux device.",
    recommendations: fallbackExists
      ? "Recommendation runs will be regenerated with Windows fallback available."
      : "Recommendation runs will be regenerated for the selected devices.",
  };
}
