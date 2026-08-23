import { afterEach, describe, expect, it, vi } from "vitest";

interface AuthCallbacks {
  signIn(args: { profile?: { email?: string } }): Promise<boolean>;
  session(args: {
    session: { user?: unknown; expires: string };
    user?: { email?: string };
  }): Promise<unknown>;
}

const nextAuthConfigs: Array<{ callbacks: AuthCallbacks }> = [];

vi.mock("next-auth", () => ({
  default: vi.fn((config: { callbacks: AuthCallbacks }) => {
    nextAuthConfigs.push(config);
    return {};
  }),
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({})) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

async function loadWithAllowedEmail(email: string | undefined) {
  vi.resetModules();
  vi.stubEnv("ALLOWED_GOOGLE_EMAIL", email ?? "");
  await import("./auth");
  return nextAuthConfigs[nextAuthConfigs.length - 1].callbacks;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signIn callback", () => {
  it("allows exactly the allowed Google account", async () => {
    const callbacks = await loadWithAllowedEmail("owner@example.com");
    await expect(callbacks.signIn({ profile: { email: "owner@example.com" } })).resolves.toBe(true);
  });

  it("rejects a different Google account", async () => {
    const callbacks = await loadWithAllowedEmail("owner@example.com");
    await expect(callbacks.signIn({ profile: { email: "intruder@example.com" } })).resolves.toBe(
      false,
    );
  });

  it("rejects every account when the allowlist is unset", async () => {
    const callbacks = await loadWithAllowedEmail(undefined);
    await expect(callbacks.signIn({ profile: { email: "owner@example.com" } })).resolves.toBe(false);
  });

  it("rejects a profile without an email", async () => {
    const callbacks = await loadWithAllowedEmail("owner@example.com");
    await expect(callbacks.signIn({ profile: {} })).resolves.toBe(false);
  });
});

describe("session callback", () => {
  it("keeps the session for the allowed user", async () => {
    const callbacks = await loadWithAllowedEmail("owner@example.com");
    const session = { user: { email: "owner@example.com" }, expires: "soon" };
    await expect(
      callbacks.session({ session, user: { email: "owner@example.com" } }),
    ).resolves.toEqual(session);
  });

  it("strips the user from a session whose identity is not allowed", async () => {
    const callbacks = await loadWithAllowedEmail("owner@example.com");
    const result = (await callbacks.session({
      session: { user: { email: "intruder@example.com" }, expires: "soon" },
      user: { email: "intruder@example.com" },
    })) as { user?: unknown; expires: string };
    expect(result.user).toBeUndefined();
    expect(result.expires).toBe("soon");
  });

  it("keeps the session untouched when the allowlist is unset", async () => {
    const callbacks = await loadWithAllowedEmail(undefined);
    const session = { user: { email: "owner@example.com" }, expires: "soon" };
    await expect(
      callbacks.session({ session, user: { email: "owner@example.com" } }),
    ).resolves.toEqual(session);
  });
});
