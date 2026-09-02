export function formatMexicoTimestamp(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}
