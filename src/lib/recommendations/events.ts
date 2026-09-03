import { ActionError } from "@/lib/action-error";
import type { Prisma, RecommendationEventKind } from "@/generated/prisma/client";

export const EVENT_RETENTION_DAYS: Record<RecommendationEventKind, number> = {
  EXPOSURE: 90,
  ROTATION: 90,
  TASTE_SETUP_ANSWER: 730,
  START: 365,
  DISMISSAL: 365,
  COMPLETION: 730,
  ABANDONMENT: 730,
};

type PlayState = "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED";

export function playStateTransitionKind(
  previous: PlayState | null,
  next: PlayState,
): "START" | "COMPLETION" | "ABANDONMENT" | null {
  if (previous === next) return null;
  if (next === "IN_PROGRESS") return "START";
  if (next === "PLAYED_BEFORE") return "COMPLETION";
  if (next === "ABANDONED") return "ABANDONMENT";
  return null;
}

export interface RecommendationEventTarget {
  gameId?: string;
  wishlistEntryId?: string;
}

export interface LogRecommendationEventInput extends RecommendationEventTarget {
  kind: RecommendationEventKind;
  runId?: string;
  reason?: string;
  payload?: Prisma.InputJsonValue;
  createdAt?: Date;
}

interface RecommendationEventClient {
  recommendationEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    deleteMany(args: { where: { kind: RecommendationEventKind; createdAt: { lt: Date } } }): Promise<{ count: number }>;
  };
}

function targetData(input: RecommendationEventTarget): { gameId?: string; wishlistEntryId?: string } {
  const targets = [input.gameId, input.wishlistEntryId].filter(
    (target): target is string => typeof target === "string" && target.trim() !== "",
  );
  if (targets.length !== 1) {
    throw new ActionError("Exactly one event target is required");
  }
  return input.gameId ? { gameId: input.gameId } : { wishlistEntryId: input.wishlistEntryId };
}

export async function logRecommendationEvent(
  client: RecommendationEventClient,
  input: LogRecommendationEventInput,
) {
  const target = targetData(input);
  return client.recommendationEvent.create({
    data: {
      kind: input.kind,
      ...target,
      ...(input.runId !== undefined && { runId: input.runId }),
      ...(input.reason !== undefined && { reason: input.reason }),
      ...(input.payload !== undefined && { payload: input.payload }),
      ...(input.createdAt !== undefined && { createdAt: input.createdAt }),
    },
  });
}

export async function pruneRecommendationEvents(
  client: RecommendationEventClient,
  now: Date,
) {
  const entries = await Promise.all(
    (Object.entries(EVENT_RETENTION_DAYS) as [RecommendationEventKind, number][]).map(
      ([kind, days]) => {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        return client.recommendationEvent.deleteMany({ where: { kind, createdAt: { lt: cutoff } } });
      },
    ),
  );
  return entries.reduce((total, result) => total + result.count, 0);
}
