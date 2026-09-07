import "server-only";

import { prisma } from "@/lib/prisma";
import { isCompatibilityActive, type OsSetup } from "./os-setup";

export interface CompatibilityGate {
  setup: OsSetup | null;
  active: boolean;
}

export async function getCompatibilityGate(): Promise<CompatibilityGate> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });

  if (!settings) {
    return { setup: null, active: false };
  }

  const setup: OsSetup = {
    primaryOs: settings.primaryOs,
    hasWindowsFallback: settings.hasWindowsFallback,
    handheldOs: settings.handheldOs,
    onboardingCompleted: settings.onboardingCompleted,
  };

  return { setup, active: isCompatibilityActive(setup) };
}
