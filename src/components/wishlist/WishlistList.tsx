import { WishlistCard } from "./WishlistCard";

interface WishlistListProps {
  baseGames: { id: string; name: string }[];
  entries: React.ComponentProps<typeof WishlistCard>["entry"][];
}

export function WishlistList({ entries, baseGames }: WishlistListProps) {
  if (entries.length === 0) {
    return (
      <div className="mt-12 rounded-lg border border-dashed border-border p-10 text-center">
        <p className="font-medium">No wishlist entries found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try changing the filters or add your first wishlist entry.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <WishlistCard key={entry.id} entry={entry} baseGames={baseGames} />
      ))}
    </div>
  );
}
