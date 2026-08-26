"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { refreshWishlistCompatibility } from "@/actions/wishlist-compatibility";
import { Button } from "@/components/ui/button";

interface WishlistCompatRefreshButtonProps {
  wishlistEntryId: string;
}

export function WishlistCompatRefreshButton({
  wishlistEntryId,
}: WishlistCompatRefreshButtonProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    const result = await refreshWishlistCompatibility({ wishlistEntryId });
    setRefreshing(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to update compatibility");
      return;
    }
    toast.success("Compatibility updated");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={refreshing}
      onClick={() => void refresh()}
      aria-label="Refresh compatibility evidence"
    >
      <RefreshCw className={refreshing ? "animate-spin" : undefined} />
    </Button>
  );
}
