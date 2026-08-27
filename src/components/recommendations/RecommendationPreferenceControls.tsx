"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { removeRecommendationPreference, setRecommendationPreference } from "@/actions/recommendations";
import { Button } from "@/components/ui/button";
import type { RecommendationProfilePayload } from "@/lib/recommendations/profile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const dimensions = ["GENRE", "TAG", "EXPERIENCE", "DURATION", "PUBLISHER", "ERA", "SERIES", "ENVIRONMENT", "MATURITY"] as const;
const attitudes = ["PREFER", "NEUTRAL", "AVOID"] as const;
const labels: Record<string, string> = {
  GENRE: "Genre", TAG: "Tag", EXPERIENCE: "Experience", DURATION: "Duration", PUBLISHER: "Publisher",
  ERA: "Era", SERIES: "Series", ENVIRONMENT: "Environment", MATURITY: "Maturity",
  PREFER: "Prefer", NEUTRAL: "Neutral", AVOID: "Avoid",
};
const displayLabel = (value: string) => labels[value] ?? (value === value.toUpperCase() ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : value);

export function RecommendationPreferenceControls({ profile, preferences }: { profile?: RecommendationProfilePayload; preferences: { id: string; dimension: string; value: string; attitude: string }[] }) {
  const router = useRouter();
  const [dimension, setDimension] = useState<(typeof dimensions)[number]>("GENRE");
  const [value, setValue] = useState("");
  const [attitude, setAttitude] = useState<(typeof attitudes)[number]>("PREFER");
  const values = Object.keys(profile?.dimensions[dimension] ?? {});

  const save = async () => {
    const result = await setRecommendationPreference({ dimension, value, attitude });
    if (!result.success) { toast.error(result.error ?? "Failed to save preference"); return; }
    toast.success("Preference saved"); router.refresh();
  };
  const remove = async (id: string) => {
    const result = await removeRecommendationPreference({ id });
    if (!result.success) { toast.error(result.error ?? "Failed to remove preference"); return; }
    toast.success("Preference removed"); router.refresh();
  };

  return <div className="mt-6 border-t border-border pt-4">
    <h3 className="text-sm font-medium">Preferences</h3>
    {preferences.length > 0 && <ul className="mt-2 space-y-1 text-sm">{preferences.map((preference) => <li key={preference.id} className="flex items-center justify-between gap-2"><span>{preference.dimension}: {preference.value} <span className="text-muted-foreground">({preference.attitude})</span></span><Button type="button" variant="ghost" size="sm" onClick={() => void remove(preference.id)}>Remove</Button></li>)}</ul>}
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs">Dimension<Select value={dimension} onValueChange={(next) => { setDimension(next as typeof dimension); setValue(""); }}><SelectTrigger aria-label="Dimension" className="mt-1 w-40"><SelectValue /></SelectTrigger><SelectContent>{dimensions.map((item) => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></label>
      <label className="text-xs">Value<Select value={value} onValueChange={setValue} disabled={values.length === 0}><SelectTrigger aria-label="Value" className="mt-1 w-48"><SelectValue placeholder="Select a value" /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{displayLabel(item)}</SelectItem>)}</SelectContent></Select></label>
      <label className="text-xs">Attitude<Select value={attitude} onValueChange={(next) => setAttitude(next as typeof attitude)}><SelectTrigger aria-label="Attitude" className="mt-1 w-32"><SelectValue /></SelectTrigger><SelectContent>{attitudes.map((item) => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></label>
      <Button type="button" onClick={() => void save()} disabled={!value}>Save preference</Button>
    </div>
  </div>;
}
