import { EXPOSURE_COOLDOWN_DAYS } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface ExposureCandidate {
  id: string;
}

export interface StaleExposureFilterResult<T extends ExposureCandidate> {
  candidates: T[];
  staleExcluded: number;
}

function exposureTime(lastExposedAt: Date | undefined): number {
  return lastExposedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

export function filterStaleExposures<T extends ExposureCandidate>(
  candidates: readonly T[],
  lastExposures: ReadonlyMap<string, Date>,
  now: Date,
  displayCount: number,
): StaleExposureFilterResult<T> {
  const cutoff = new Date(now.getTime() - EXPOSURE_COOLDOWN_DAYS * DAY_MS);
  const fresh = candidates.filter((candidate) => {
    const lastExposedAt = lastExposures.get(candidate.id);
    return !lastExposedAt || lastExposedAt < cutoff;
  });

  if (fresh.length >= displayCount) {
    return {
      candidates: [...fresh],
      staleExcluded: candidates.length - fresh.length,
    };
  }

  const ordered = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const byExposureAge = exposureTime(lastExposures.get(left.candidate.id)) - exposureTime(lastExposures.get(right.candidate.id));
      return byExposureAge || left.index - right.index;
    })
    .map(({ candidate }) => candidate);

  return { candidates: ordered, staleExcluded: 0 };
}
