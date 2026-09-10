import "server-only";

import type { IgdbProviderError } from "./igdb-types";
import { prisma } from "@/lib/prisma";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TOKEN_TIMEOUT_MS = 10_000;
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export interface IgdbConfig {
  clientId: string;
  clientSecret: string;
}

export type IgdbConfigResult =
  | { ok: true; config: IgdbConfig }
  | { ok: false; error: IgdbProviderError };

export type IgdbAccessTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: IgdbProviderError };

let refreshPromise: Promise<IgdbAccessTokenResult> | null = null;
let invalidated = false;

function configurationError(message: string): IgdbProviderError {
  return { category: "CONFIGURATION", message };
}

function networkError(message: string): IgdbProviderError {
  return { category: "NETWORK", message };
}

export function getIgdbConfig(): IgdbConfigResult {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: configurationError(
        "IGDB is not configured: set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET",
      ),
    };
  }
  return { ok: true, config: { clientId, clientSecret } };
}

function malformedTokenError(): IgdbProviderError {
  return {
    category: "CONFIGURATION",
    message: "Twitch returned an invalid IGDB access token response",
  };
}

async function requestToken(
  config: IgdbConfig,
): Promise<IgdbAccessTokenResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          category: "HTTP",
          message: "Twitch rejected the IGDB token request",
          status: response.status,
        },
      };
    }

    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { access_token?: unknown }).access_token !== "string" ||
      (body as { access_token: string }).access_token.length === 0 ||
      typeof (body as { expires_in?: unknown }).expires_in !== "number" ||
      !Number.isFinite((body as { expires_in: number }).expires_in) ||
      (body as { expires_in: number }).expires_in <= 0
    ) {
      return { ok: false, error: malformedTokenError() };
    }

    const accessToken = (body as { access_token: string }).access_token;
    const expiresIn = (body as { expires_in: number }).expires_in;
    const expiresAt = new Date(Date.now() + expiresIn * 1_000);
    await prisma.igdbTokenCache.upsert({
      where: { id: 1 },
      create: { id: 1, accessToken, expiresAt },
      update: { accessToken, expiresAt },
    });
    invalidated = false;
    return { ok: true, token: accessToken };
  } catch (error) {
    return {
      ok: false,
      error: networkError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Twitch token request timed out"
          : "Twitch token request could not be completed",
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshToken(
  config: IgdbConfig,
  cached: { accessToken: string; expiresAt: Date } | null,
): Promise<IgdbAccessTokenResult> {
  if (!refreshPromise) {
    refreshPromise = requestToken(config).finally(() => {
      refreshPromise = null;
    });
  }
  const refreshed = await refreshPromise;
  if (!refreshed.ok && cached && cached.expiresAt.getTime() > Date.now()) {
    return { ok: true, token: cached.accessToken };
  }
  return refreshed;
}

export async function getIgdbAccessToken(): Promise<IgdbAccessTokenResult> {
  const configResult = getIgdbConfig();
  if (!configResult.ok) return configResult;

  const cached = await prisma.igdbTokenCache.findUnique({ where: { id: 1 } });
  const isReusable =
    !invalidated &&
    cached !== null &&
    cached.expiresAt.getTime() - Date.now() > REFRESH_WINDOW_MS;
  if (isReusable) return { ok: true, token: cached.accessToken };

  return refreshToken(configResult.config, cached);
}

export function invalidateIgdbToken(): void {
  invalidated = true;
}
