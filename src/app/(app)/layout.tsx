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
      <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
    </div>
  );
}
