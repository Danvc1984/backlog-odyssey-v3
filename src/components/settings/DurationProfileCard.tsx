"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateDurationProfile } from "@/actions/settings";
import { SegmentedControl, type Option } from "@/components/preferences/SegmentedControl";
import { SectionCard } from "@/components/ui/detail-card";

type DurationProfile = "HASTILY" | "NORMALLY" | "COMPLETELY";

const options: readonly Option<DurationProfile>[] = [
  { value: "HASTILY", label: "Main story" },
  { value: "NORMALLY", label: "Main + extras" },
  { value: "COMPLETELY", label: "Completionist" },
];

export function DurationProfileCard({ initialProfile }: { initialProfile: DurationProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);

  const changeProfile = async (next: DurationProfile) => {
    if (saving || next === profile) return;
    const previous = profile;
    setProfile(next);
    setSaving(true);
    const result = await updateDurationProfile({ durationProfile: next });
    setSaving(false);
    if (!result.success) {
      setProfile(previous);
      toast.error(result.error ?? "Failed to update duration profile");
      return;
    }
    toast.success("Duration profile updated");
  };

  return (
    <SectionCard
      eyebrow="Recommendations"
      title="Duration profile"
      description="Choose which IGDB time-to-beat estimate represents your expected playthrough."
    >
      <SegmentedControl value={profile} options={options} onChange={(value) => void changeProfile(value)} label="Duration profile" />
      {saving && <p className="mt-2 text-xs text-muted-foreground">Saving...</p>}
    </SectionCard>
  );
}
