"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fillWishlistRawgMetadata } from "@/actions/wishlist-rawg";
import { Button } from "@/components/ui/button";

interface WishlistRawgFillButtonProps {
  wishlistEntryId: string;
}

export function WishlistRawgFillButton({
  wishlistEntryId,
}: WishlistRawgFillButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await fillWishlistRawgMetadata({ wishlistEntryId });
    setLoading(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Failed to load RAWG metadata");
      return;
    }
    toast.success("RAWG metadata loaded");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={() => void load()}
    >
      {loading ? "Loading..." : "Load RAWG metadata"}
    </Button>
  );
}
