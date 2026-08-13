import { auth, signIn, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Backlog Odyssey</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Private gaming library, wishlist, and decision assistant.
      </p>
      {session?.user ? (
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button className="rounded-md bg-foreground px-4 py-2 text-background">
            Sign out
          </button>
        </form>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button className="rounded-md bg-foreground px-4 py-2 text-background">
            Sign in with Google
          </button>
        </form>
      )}
    </main>
  );
}