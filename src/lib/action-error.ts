export class ActionError extends Error {}

export function friendlyActionError(error: unknown, fallback: string): string {
  if (error instanceof ActionError) {
    return error.message;
  }

  console.error(fallback, error);
  return fallback;
}
