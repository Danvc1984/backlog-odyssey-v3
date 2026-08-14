import Link from "next/link";

interface ErrorPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {error === "AccessDenied"
          ? "Access Denied"
          : "Authentication Error"}
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        {error === "AccessDenied"
          ? "You do not have permission to sign in."
          : "An error occurred during authentication."}
      </p>
      <Link
        href="/"
        className="rounded-md bg-foreground px-4 py-2 text-background"
      >
        Sign in
      </Link>
    </main>
  );
}