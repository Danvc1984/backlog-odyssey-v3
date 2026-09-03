import Link from "next/link";
import { AddWishlistDialog } from "@/components/wishlist/AddWishlistDialog";
import { CreateDlcDialog } from "./CreateDlcDialog";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

interface DlcItem {
  id: string;
  name: string;
}

interface WishlistDlcItem {
  id: string;
  name: string;
  interest: number | null;
}

export function DlcSection({
  baseGameId,
  baseGameName,
  baseGames,
  dlcs,
  wishlistDlcs,
}: {
  baseGameId: string;
  baseGameName: string;
  baseGames: { id: string; name: string }[];
  dlcs: DlcItem[];
  wishlistDlcs: WishlistDlcItem[];
}) {
  const hasDlcs = dlcs.length > 0 || wishlistDlcs.length > 0;

  return (
    <SectionCard
      eyebrow="Related content"
      title="DLC & expansions"
      description="Attached catalog content stays close to its base game."
      status={<StatusPill>{dlcs.length + wishlistDlcs.length} linked</StatusPill>}
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <CreateDlcDialog baseGameId={baseGameId} />
        <AddWishlistDialog
          baseGames={baseGames}
          initialType="DLC"
          initialBaseGameId={baseGameId}
          triggerLabel="Add wishlist DLC"
        />
      </div>
      {!hasDlcs ? (
        <p className="text-sm text-muted-foreground">
          No purchased or wishlist DLC for {baseGameName}.
        </p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {dlcs.map((dlc) => (
            <li key={`acquired-${dlc.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span>{dlc.name}</span>
              <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Acquired
              </span>
            </li>
          ))}
          {wishlistDlcs.map((dlc) => (
            <li key={`wishlist-${dlc.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Link href={`/wishlist/${dlc.id}`} className="hover:underline">
                {dlc.name}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                {dlc.interest ? (
                  <span className="text-muted-foreground" aria-label={`${dlc.interest} of 5 stars`}>
                    {`${"★".repeat(dlc.interest)}${"☆".repeat(5 - dlc.interest)}`}
                  </span>
                ) : null}
                <span className="rounded-md border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  In wishlist
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {wishlistDlcs.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/wishlist?type=DLC" className="text-primary hover:underline">
            View all wishlist DLC
          </Link>
        </p>
      )}
    </SectionCard>
  );
}
