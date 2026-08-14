import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import { AppNav } from "./_components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  return (
    <div className="flex min-h-screen">
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
