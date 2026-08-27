import type { RecommendationProfilePayload } from "@/lib/recommendations/profile";
import { RebuildRecommendationProfileButton } from "./RebuildRecommendationProfileButton";
import { RecommendationPreferenceControls } from "./RecommendationPreferenceControls";

const labels: Record<string, string> = {
  GENRE: "Genre", TAG: "Tag", EXPERIENCE: "Experience", DURATION: "Duration", PUBLISHER: "Publisher",
  ERA: "Era", SERIES: "Series", ENVIRONMENT: "Environment", MATURITY: "Maturity",
};

interface RecommendationProfileSectionProps {
  profile: { payload: unknown; rebuiltAt: Date } | null;
  preferences: { id: string; dimension: string; value: string; attitude: string }[];
}

function ProfileContent({ payload }: { payload: RecommendationProfilePayload }) {
  const hasEvents = payload.evidence.eventsConsidered > 0;
  if (!hasEvents) {
    return <p className="mt-4 text-sm text-muted-foreground">Not enough history yet. Play, finish, or dismiss games and the profile will build from that.</p>;
  }
  return (
    <>
      <div className="mt-3 text-sm text-muted-foreground">
        <p>{payload.evidence.eventsConsidered} events considered, {payload.evidence.unresolvedTargets} unresolved targets</p>
        <p className="mt-1">{Object.entries(payload.evidence.byKind).map(([kind, count]) => `${kind}: ${count}`).join(" · ")}</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {Object.entries(payload.dimensions).map(([dimension, signals]) => {
          const top = Object.entries(signals).sort(([, a], [, b]) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 8);
          return <div key={dimension} className="rounded-md border border-border p-3">
            <h3 className="text-sm font-medium">{labels[dimension] ?? dimension}</h3>
            {top.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No signals yet.</p> : <ul className="mt-2 space-y-1 text-sm">
              {top.map(([value, signal]) => <li key={value} className="flex justify-between gap-3"><span className="truncate">{value}</span><span className="shrink-0 text-muted-foreground">{signal.weight >= 0 ? "+" : ""}{signal.weight.toFixed(2)} · {signal.support}</span></li>)}
            </ul>}
          </div>;
        })}
      </div>
    </>
  );
}

export function RecommendationProfileSection({ profile, preferences }: RecommendationProfileSectionProps) {
  const payload = profile?.payload as RecommendationProfilePayload | undefined;
  return <section className="mt-6 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recommendation profile</h2>
        {profile && <p className="mt-2 text-xs text-muted-foreground">Rebuilt {profile.rebuiltAt.toLocaleString()}</p>}</div>
      <RebuildRecommendationProfileButton />
    </div>
    {payload ? <ProfileContent payload={payload} /> : <p className="mt-4 text-sm text-muted-foreground">Not enough history yet. Play, finish, or dismiss games and the profile will build from that.</p>}
    <RecommendationPreferenceControls profile={payload} preferences={preferences} />
  </section>;
}
