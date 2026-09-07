import { redirect } from "next/navigation";
import { WelcomeSetupForm } from "@/components/onboarding/WelcomeSetupForm";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default async function WelcomePage() {
  await requireUser();
  const [settings, gameCount] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { onboardingCompleted: true } }),
    prisma.game.count({ where: { type: "BASE_GAME" } }),
  ]);
  if (settings?.onboardingCompleted) redirect("/today");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="technical-label text-muted-foreground">Welcome</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Set up your environment</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This tells Backlog Odyssey which devices matter for compatibility and recommendations. You can change it later.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Examples: Linux includes Bazzite or Ubuntu, while Windows includes Windows 10 or 11. A Steam Deck is a Linux handheld; a ROG Ally is a Windows handheld.
        </p>
        <div className="mt-6">
          <WelcomeSetupForm gameCount={gameCount} />
        </div>
      </section>
    </main>
  );
}
