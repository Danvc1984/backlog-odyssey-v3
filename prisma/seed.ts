import { prisma } from "../src/lib/prisma";

async function main() {
  // Seed the singleton AppSettings record (fixed environment profile from the PRD).
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      theme: "SYSTEM",
      desktopOs: "BAZZITE",
      portableDevice: "STEAM_DECK",
      fallbackOs: "WINDOWS",
      priceCountry: "MX",
      timeZone: "America/Mexico_City",
    },
  });

  await prisma.wallpaperState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, selectedIdx: 0 },
  });

  console.log("Seed complete: AppSettings and WallpaperState singletons created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });