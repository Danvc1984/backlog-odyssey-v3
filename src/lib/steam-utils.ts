const TRADEMARK_SYMBOLS = /[\u2122\u00AE\u00A9]/g;

export function stripTrademarkSymbols(name: string): string {
  const stripped = name.replace(TRADEMARK_SYMBOLS, "").trimEnd();
  return stripped || name;
}

export function lastPlayedDate(timestamp: number): Date | null {
  return timestamp > 0 ? new Date(timestamp * 1000) : null;
}
