import Link from "next/link";
import { WishlistCard } from "./WishlistCard";

interface WishlistListProps {
  baseGames: { id: string; name: string }[];
  entries: React.ComponentProps<typeof WishlistCard>["entry"][];
  view?: "focus" | "list";
  hasFilters?: boolean;
}

export function WishlistList({ entries, baseGames, view = "focus", hasFilters = false }: WishlistListProps) {
  if (entries.length === 0) {
    return (
      <div className="mt-12 rounded-lg border border-dashed border-border p-10 text-center">
        <p className="technical-label text-muted-foreground">
          {hasFilters ? "No wishes on this course" : "The wishlist awaits"}
        </p>
        <p className="mt-2 font-medium">
          {hasFilters ? "No wishes match these filters." : "Add your first wishlist entry."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters ? "Change course with the filters to reveal more of your wishlist." : "Your decision queue will gather here."}
        </p>
        {hasFilters && (
          <Link href="/wishlist" className="mt-4 inline-block text-sm font-medium text-signal-strong hover:underline">
            Clear filters
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={view === "list" ? "mt-6 grid gap-3" : "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {entries.map((entry) => (
        <WishlistCard key={entry.id} entry={entry} baseGames={baseGames} variant={view} />
      ))}
    </div>
  );
}
