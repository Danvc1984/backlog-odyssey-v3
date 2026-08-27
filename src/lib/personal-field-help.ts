export const PERSONAL_FIELD_HELP = {
  priority: "Short-term urgency for deciding what to play next.",
  interest: "Durable desire to play, independent of current urgency.",
  rating: "Your personal assessment after spending time with the game.",
  preferredEnvironment: "Where you prefer to play this game.",
  gameExperience: "The session fit, not the platform or compatibility.",
  notes: "Personal context that does not fit the structured fields.",
} as const;

export const GAME_EXPERIENCE_LABELS = {
  PC_GAMING: "PC gaming",
  MULTIPLAYER_COOP: "Multiplayer & co-op",
  COUCH_GAMING: "Couch gaming",
  ON_THE_GO: "On the go",
} as const;
