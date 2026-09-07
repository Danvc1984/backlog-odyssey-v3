import { prisma } from "../src/lib/prisma";

async function main() {
  // Seed a neutral setup so a fresh database starts in onboarding.
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {
      primaryOs: "LINUX",
      hasWindowsFallback: false,
      handheldOs: "NONE",
      onboardingCompleted: false,
    },
    create: {
      id: 1,
      theme: "SYSTEM",
      primaryOs: "LINUX",
      hasWindowsFallback: false,
      handheldOs: "NONE",
      onboardingCompleted: false,
      priceCountry: "MX",
      timeZone: "America/Mexico_City",
    },
  });

  await prisma.wallpaperState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, selectedIdx: 0 },
  });

  console.log("Seed complete: neutral AppSettings and WallpaperState singletons created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
