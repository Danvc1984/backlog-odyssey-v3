export type PlayState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface PlayStateMutation {
  playState?: PlayState;
  playSoon?: boolean;
  replayCandidate?: boolean;
  hidden?: boolean;
  completedBefore?: boolean;
  isMainGame?: boolean;
}

export interface ExistingPlayState {
  playState: PlayState;
}

/**
 * Applies the cross-surface rules for a library-entry update.
 * State transitions take precedence over conflicting replay/history flags.
 */
export function derivePlayStateMutation(
  current: ExistingPlayState,
  requested: PlayStateMutation,
): PlayStateMutation {
  const leavingCompleted =
    requested.playState !== undefined &&
    current.playState === "COMPLETED" &&
    requested.playState !== "COMPLETED";

  return {
    ...(requested.playState !== undefined && { playState: requested.playState }),
    ...(requested.playSoon !== undefined && { playSoon: requested.playSoon }),
    ...(requested.replayCandidate !== undefined && {
      replayCandidate: requested.replayCandidate,
    }),
    ...(requested.hidden !== undefined && { hidden: requested.hidden }),
    ...(requested.completedBefore !== undefined && {
      completedBefore: requested.completedBefore,
    }),
    ...(requested.isMainGame !== undefined && { isMainGame: requested.isMainGame }),
    ...(leavingCompleted && { completedBefore: true }),
    ...(requested.playState === "IN_PROGRESS" && { replayCandidate: false }),
  };
}
