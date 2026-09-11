import { isActiveIgdbJobStatus } from "./igdb-job";
import type { IgdbBatchJobStatus } from "./igdb-batch-runner";

export type EligibleGame = {
  id: string;
  metadataSnapshots: { id: string }[];
  playtimeEvidence: { id: string } | null;
  enrichmentJobs: IgdbBatchJobStatus[];
};

export function getIgdbBatchEligibility(games: EligibleGame[]) {
  const fullyEnriched = games.filter((game) => game.metadataSnapshots.length > 0 && game.playtimeEvidence !== null);
  const eligibleGames = games.filter(
    (game) =>
      !fullyEnriched.some((item) => item.id === game.id) &&
      !game.enrichmentJobs.some((job) => isActiveIgdbJobStatus(job.status)),
  );

  return {
    eligibleGames,
    counts: {
      eligible: eligibleGames.length,
      queued: eligibleGames.length,
      skippedFullyEnriched: fullyEnriched.length,
      skippedActiveWork: games.length - fullyEnriched.length - eligibleGames.length,
    },
  };
}
