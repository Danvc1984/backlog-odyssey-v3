import type { RecommendationProfilePayload } from "@/lib/recommendations/profile";
import { SectionCard } from "@/components/ui/detail-card";
import { RebuildRecommendationProfileButton } from "./RebuildRecommendationProfileButton";
import { RecommendationPreferenceControls } from "./RecommendationPreferenceControls";
import { RestartRecommendationsAction } from "./RestartRecommendationsSection";

const labels: Record<string, string> = {
  GENRE: "Genre",
  TAG: "Tag",
  EXPERIENCE: "Experience",
  DURATION: "Duration",
  PUBLISHER: "Publisher",
  ERA: "Era",
  SERIES: "Series",
  ENVIRONMENT: "Environment",
  MATURITY: "Maturity",
};

interface RecommendationProfileSectionProps {
  profile: { payload: unknown; rebuiltAt: Date } | null;
  preferences: {
    id: string;
    dimension: string;
    value: string;
    attitude: string;
  }[];
}

function profileHealth(payload: RecommendationProfilePayload | undefined) {
  if (!payload || payload.evidence.eventsConsidered === 0) {
    return {
      label: "Getting started",
      description: "Your profile will learn as you play, finish, or dismiss games.",
      action: "Start using recommendations to build a useful profile.",
    };
  }

  if (payload.evidence.unresolvedTargets > 0) {
    return {
      label: "Needs a refresh",
      description: "Your profile has useful learning, but some recent choices need matching game data.",
      action: "Enrich affected games, then rebuild the profile.",
    };
  }

  return {
    label: "Learning well",
    description: "Your recent choices are available to improve recommendation ranking.",
    action: "Keep rating recommendations to make the profile more personal.",
  };
}

function ProfileContent({
  payload,
}: {
  payload: RecommendationProfilePayload;
}) {
  if (payload.evidence.eventsConsidered === 0) {
    return null;
  }

  return (
    <details className="mt-4 rounded-md border border-border bg-card-alt/30 p-4">
      <summary className="cursor-pointer font-medium">Learned signals</summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {Object.entries(payload.dimensions).map(([dimension, signals]) => {
          const top = Object.entries(signals)
            .sort(([, a], [, b]) => Math.abs(b.weight) - Math.abs(a.weight))
            .slice(0, 8);
          return (
            <div
              key={dimension}
              className="rounded-md border border-border p-3"
            >
              <h3 className="text-sm font-medium">
                {labels[dimension] ?? dimension}
              </h3>
              {top.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No signals yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {top.map(([value, signal]) => (
                    <li key={value} className="flex justify-between gap-3">
                      <span className="truncate">{value}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {signal.weight >= 0 ? "Leans toward" : "Leans away from"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function RecommendationProfileSection({
  profile,
  preferences,
}: RecommendationProfileSectionProps) {
  const payload = profile?.payload as RecommendationProfilePayload | undefined;
  const health = profileHealth(payload);
  return (
    <SectionCard
        title="Recommendation Profile"
      id="recommendation-profile-heading"
      description="Tune how recommendations learn from your choices. Resetting recommendations does not change your games, wishlist, offers, or provider data."
      aside={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RebuildRecommendationProfileButton />
          <RestartRecommendationsAction />
        </div>
      }
    >
      <RecommendationPreferenceControls profile={payload} preferences={preferences} />
      <div className="mt-4 rounded-md border border-border bg-card-alt/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{health.label}</h3>
          <span className="technical-label text-muted-foreground">Profile health</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{health.description}</p>
        <p className="mt-2 text-sm">Next: {health.action}</p>
      </div>
      {payload && <ProfileContent payload={payload} />}
    </SectionCard>
  );
}
