import Link from "next/link";
import { AddWishlistDialog } from "@/components/wishlist/AddWishlistDialog";
import { CreateDlcDialog } from "./CreateDlcDialog";
import { FetchDlcDialog } from "./FetchDlcDialog";
import { DlcCardShelves } from "./DlcCardShelves";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

interface DlcItem {
  id: string;
  name: string;
  coverUrl: string | null;
  matchStatus: "enriched" | "pending" | "no-match";
}

interface WishlistDlcItem {
  id: string;
  name: string;
  interest: number | null;
  coverUrl: string | null;
}

export function DlcSection({
  baseGameId,
  baseGameName,
  baseGames,
  hasSteamAppId,
  dlcs,
  wishlistDlcs,
}: {
  baseGameId: string;
  baseGameName: string;
  baseGames: { id: string; name: string }[];
  hasSteamAppId: boolean;
  dlcs: DlcItem[];
  wishlistDlcs: WishlistDlcItem[];
}) {
  const hasDlcs = dlcs.length > 0 || wishlistDlcs.length > 0;

  return (
    <SectionCard
      eyebrow="Related content"
      title="DLC & expansions"
      description="Acquired and wishlist DLC stay in separate, paginated shelves. DLCs do not add play states."
      status={<StatusPill>{dlcs.length + wishlistDlcs.length} linked</StatusPill>}
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {hasSteamAppId && <FetchDlcDialog baseGameId={baseGameId} />}
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
        <DlcCardShelves dlcs={dlcs} wishlistDlcs={wishlistDlcs} />
      )}
      {wishlistDlcs.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/wishlist?type=DLC" className="text-primary hover:underline">
            View all wishlist DLC
          </Link>
        </p>
      )}
    </SectionCard>
  );
}
