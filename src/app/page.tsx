import { GoogleLogoIcon } from "@phosphor-icons/react/ssr";
import { redirect } from "next/navigation";
import { SignInIntroductionDemo } from "@/components/auth/SignInIntroductionDemo";
import { auth, signIn } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/today");
  }

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-4 lg:p-6">
      <div className="grid w-full max-w-6xl items-stretch gap-5 lg:h-[calc(100dvh-3rem)] lg:max-h-[46rem] lg:grid-cols-[minmax(0,0.8fr)_minmax(26rem,1.2fr)]">
        <section className="flex min-h-[28rem] flex-col justify-center rounded-3xl border border-border bg-card p-7 text-center shadow-card sm:p-10 lg:min-h-0 lg:p-8 lg:text-left">
          <div className="mx-auto flex max-w-md flex-col items-center lg:mx-0 lg:items-start">
            <p className="technical-label text-signal">
              Your game library, charted
            </p>
            <div className="mt-7 flex items-center gap-3 text-primary">
              <span aria-hidden className="brand-dragon-mark size-12 shrink-0 bg-primary" />
              <h1 className="text-4xl text-foreground sm:text-5xl">
                Backlog Odyssey
              </h1>
            </div>
            <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground sm:text-lg">
              Turn your gaming backlog into your next adventure.
            </p>
            <form
              className="mt-8"
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">
                <GoogleLogoIcon aria-hidden className="size-4" weight="bold" />
                Sign in to begin your voyage
              </button>
            </form>
          </div>
        </section>
        <SignInIntroductionDemo />
      </div>
    </main>
  );
}
