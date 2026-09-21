export function normalizePersonalTagName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function preparePersonalTagName(name: string): {
  name: string;
  normalizedName: string;
} {
  const trimmedName = name.trim();
  return {
    name: trimmedName,
    normalizedName: normalizePersonalTagName(trimmedName),
  };
}
