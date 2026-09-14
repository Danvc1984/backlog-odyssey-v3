export function parseHasDlcFilter(value?: string): true | undefined {
  return value === "true" ? true : undefined;
}
