export function lastPlayedDate(timestamp: number): Date | null {
  return timestamp > 0 ? new Date(timestamp * 1000) : null;
}
