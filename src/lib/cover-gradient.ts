export const COVER_GRADIENTS = [
  "from-signal/80 via-card to-card-alt",
  "from-opportunity/80 via-card to-card-alt",
  "from-primary/80 via-card to-card-alt",
  "from-warning/80 via-card to-card-alt",
] as const;

export function gradientFor(id: string): string {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}