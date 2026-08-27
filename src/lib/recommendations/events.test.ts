import { describe, expect, it, vi } from "vitest";

import {
  EVENT_RETENTION_DAYS,
  logRecommendationEvent,
  playStateTransitionKind,
  pruneRecommendationEvents,
} from "./events";

describe("playStateTransitionKind", () => {
  it.each([
    ["NOT_STARTED", "IN_PROGRESS", "START"],
    ["IN_PROGRESS", "PLAYED_BEFORE", "COMPLETION"],
    ["NOT_STARTED", "PLAYED_BEFORE", "COMPLETION"],
    ["IN_PROGRESS", "ABANDONED", "ABANDONMENT"],
    ["PLAYED_BEFORE", "ABANDONED", "ABANDONMENT"],
  ])("maps %s -> %s to %s", (previous, next, expected) => {
    expect(playStateTransitionKind(previous as never, next as never)).toBe(expected);
  });

  it.each([
    ["NOT_STARTED", "NOT_STARTED"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["ABANDONED", "NOT_STARTED"],
    ["PLAYED_BEFORE", "NOT_STARTED"],
  ])("does not emit for %s -> %s", (previous, next) => {
    expect(playStateTransitionKind(previous as never, next as never)).toBeNull();
  });
});

describe("logRecommendationEvent", () => {
  it("requires exactly one non-empty target", async () => {
    const client = { recommendationEvent: { create: vi.fn(), deleteMany: vi.fn() } };

    await expect(logRecommendationEvent(client, { kind: "START" })).rejects.toThrow(
      "Exactly one event target is required",
    );
    await expect(logRecommendationEvent(client, {
      kind: "START",
      gameId: "game-1",
      wishlistEntryId: "wish-1",
    })).rejects.toThrow("Exactly one event target is required");
    expect(client.recommendationEvent.create).not.toHaveBeenCalled();
  });

  it("appends one event with its target and optional fields", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const client = { recommendationEvent: { create, deleteMany: vi.fn() } };
    const createdAt = new Date("2026-08-27T12:00:00.000Z");

    await logRecommendationEvent(client, {
      kind: "DISMISSAL",
      wishlistEntryId: "wish-1",
      runId: "run-1",
      reason: "Already bought it",
      payload: { answer: "SKIPPED" },
      createdAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        kind: "DISMISSAL",
        wishlistEntryId: "wish-1",
        runId: "run-1",
        reason: "Already bought it",
        payload: { answer: "SKIPPED" },
        createdAt,
      },
    });
  });
});

describe("pruneRecommendationEvents", () => {
  it("deletes each kind at its retention cutoff", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = { recommendationEvent: { create: vi.fn(), deleteMany } };
    const now = new Date("2026-08-27T12:00:00.000Z");

    await pruneRecommendationEvents(client, now);

    expect(deleteMany).toHaveBeenCalledTimes(Object.keys(EVENT_RETENTION_DAYS).length);
    for (const [kind, days] of Object.entries(EVENT_RETENTION_DAYS)) {
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          kind,
          createdAt: { lt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) },
        },
      });
    }
  });
});
