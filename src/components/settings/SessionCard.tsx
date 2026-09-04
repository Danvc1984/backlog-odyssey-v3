import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

export function SessionCard({
  email,
  signOutAction,
}: {
  email: string | null;
  signOutAction: () => Promise<void>;
}) {
  return (
    <SectionCard
      eyebrow="Account"
      title="Google session"
      description="The Google account signed into this app instance."
      status={<StatusPill tone="ok">Connected</StatusPill>}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {email ? (
            <span className="font-medium">{email}</span>
          ) : (
            <span className="text-muted-foreground">Signed in</span>
          )}
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut aria-hidden className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </SectionCard>
  );
}
