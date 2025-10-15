// src/endpoints/challenge.ts
import { Bool, Num, Str, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const toBase64Url = (bytes: Uint8Array): string => {
  let ascii = "";
  for (let index = 0; index < bytes.length; index++)
    ascii += String.fromCharCode(bytes[index]);
  return btoa(ascii)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
};

const deriveRpId = (hostname: string): string => {
  const cleanHost = hostname.replace(/:\d+$/u, "");
  if (cleanHost === "localhost" || cleanHost === "127.0.0.1") return cleanHost;
  if (cleanHost === "vorte.app" || cleanHost.endsWith(".vorte.app"))
    return "vorte.app";
  return "vorte.app";
};

// fingerprint -> expiresAt (epoch ms)
const ratelimitCache: Map<string, number> = new Map();
const WINDOW_MS = 60_000;
const LIMIT_HEADER = "1;w=60";
const FINGERPRINT_RE = /^[a-fA-F0-9]{32}$/;

export class Challenge extends OpenAPIRoute {
  schema = {
    tags: ["WebAuthn"],
    summary:
      'Return a "transactionId" and "options" to start a fully discoverable WebAuthn assertion.',
    // STRICT: header-validaatio regexillä
    request: {
      headers: z.object({
        "x-fingerprint": Str()
          .regex(
            FINGERPRINT_RE,
            "Invalid X-Fingerprint format (expected 32 hex characters)"
          )
          .transform((s) => s.trim()),
      }),
    },
    responses: {
      "200": {
        description: "WebAuthn assertion init payload",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              result: z.object({
                transactionId: Str(),
                options: z.object({
                  challenge: Str(),
                  rpId: Str(),
                  userVerification: Str(), // "required"
                  timeout: Num(),
                }),
              }),
            }),
            examples: {
              ok: {
                value: {
                  success: true,
                  result: {
                    transactionId: "0ff72376-a0b7-4a92-a2e9-a117ef916302",
                    options: {
                      challenge: "IEm_pXJwb3-GVyBcQNhj1-gDSiLT_v-fRQE_A3j-N3o",
                      rpId: "vorte.app",
                      userVerification: "required",
                      timeout: 60000,
                    },
                  },
                },
              },
            },
          },
        },
      },
      "400": {
        description: "Missing or invalid X-Fingerprint header",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              error: Str(),
            }),
            examples: {
              bad: {
                value: {
                  success: false,
                  error: "X-Fingerprint header is required or invalid",
                },
              },
            },
          },
        },
      },
      "429": {
        description: "Too many requests (edge ratelimit per fingerprint)",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              error: Str(),
            }),
            examples: {
              limited: {
                value: {
                  success: false,
                  error: "Only 1 challenge per 60 seconds (per fingerprint)",
                },
              },
            },
          },
        },
      },
    },
  };

  async handle(ctx: AppContext) {
    ctx.header("Cache-Control", "private, max-age=60, s-maxage=0");
    ctx.header("Vary", "X-Fingerprint");
    ctx.header("Content-Type", "application/json; charset=utf-8");

    const {
      headers: { "x-fingerprint": fingerprint },
    } = await this.getValidatedData<typeof this.schema>();

    const hostname = new URL(ctx.req.url).hostname;
    const rpId = deriveRpId(hostname);
    const key = `${rpId}::${fingerprint}`;

    const now = Date.now();
    const currentExpiresAt = ratelimitCache.get(key);

    if (typeof currentExpiresAt === "number" && currentExpiresAt > now) {
      const secondsLeft = Math.max(
        1,
        Math.ceil((currentExpiresAt - now) / 1000)
      );
      ctx.header("RateLimit-Limit", LIMIT_HEADER);
      ctx.header("RateLimit-Remaining", "0");
      ctx.header("RateLimit-Reset", String(secondsLeft));
      ctx.header("Retry-After", String(secondsLeft));
      ctx.status(429);
      return {
        success: false,
        error: "Only 1 challenge per 60 seconds (per fingerprint)",
      };
    }

    ratelimitCache.set(key, now + WINDOW_MS);

    ctx.header("RateLimit-Limit", LIMIT_HEADER);
    ctx.header("RateLimit-Remaining", "0");
    ctx.header("RateLimit-Reset", "60");

    const transactionId = crypto.randomUUID();
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challengeB64Url = toBase64Url(challengeBytes);

    return {
      success: true,
      result: {
        transactionId,
        options: {
          challenge: challengeB64Url,
          rpId,
          userVerification: "required",
          timeout: 60_000,
        },
      },
    };
  }
}
