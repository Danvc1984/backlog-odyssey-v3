import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import { AppNav } from "./_components/AppNav";
import { ActiveOperationsWatcher } from "@/components/games/ActiveOperationsWatcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  return (
    <div className="flex min-h-screen">
      <ActiveOperationsWatcher />
      <AppNav
        email={session.user?.email}
        signOutAction={async () => {
          "use server";
          await signOut();
        }}
      />
      <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 pt-8 pb-24 md:px-[clamp(24px,5vw,72px)] md:pt-10 md:pb-12">
        {children}
      </main>
    </div>
  );
}
