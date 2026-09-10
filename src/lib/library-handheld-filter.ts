export function parseHandheldSuitabilityFilter(
  value?: string,
): true | null | undefined {
  if (value === "marked") return true;
  if (value === "unmarked") return null;
  return undefined;
}
