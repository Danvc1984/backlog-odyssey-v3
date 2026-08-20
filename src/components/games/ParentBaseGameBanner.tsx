import Link from "next/link";

export function ParentBaseGameBanner({
  baseGame,
}: {
  baseGame: { id: string; name: string } | null;
}) {
  if (!baseGame) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        This DLC has no valid base game.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <span className="text-muted-foreground">DLC for </span>
      <Link href={`/games/${baseGame.id}`} className="font-medium hover:underline">
        {baseGame.name}
      </Link>
    </div>
  );
}
