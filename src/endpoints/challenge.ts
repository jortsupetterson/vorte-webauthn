import { Bool, Str, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");

const WINDOW_MS = 60_000;
const LIMIT_HEADER = "1;w=60";
const FINGERPRINT_RE = /^[a-f0-9]{32}$/i;

export class Challenge extends OpenAPIRoute {
  schema = {
    tags: ["Vorte", "WebAuthn"],
    summary: "Initialize a minimal WebAuthn transaction (login/registration).",
    request: {
      headers: z.object({
        "x-fingerprint": Str()
          .regex(FINGERPRINT_RE, "Invalid fingerprint (expect 32 hex chars)")
          .openapi({
            example: "0e75dfbfc3a182fa1f652635f7ee588c",
            description: "Client-provided fingerprint for rate limiting",
          }),
      }),
    },
    responses: {
      "200": {
        description: "Transaction initiated",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              result: z.object({
                transactionId: Str(),
                challenge: Str(),
              }),
            }),
            examples: {
              ok: {
                value: {
                  success: true,
                  result: {
                    transactionId: "0ff72376-a0b7-4a92-a2e9-a117ef916302",
                    challenge: "IEm_pXJwb3-GVyBcQNhj1-gDSiLT_v-fRQE_A3j-N3o",
                  },
                },
              },
            },
          },
        },
      },
      "400": {
        description: "Missing/invalid headers",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: Str() }),
          },
        },
      },
      "403": {
        description: "Origin not allowed",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: Str() }),
          },
        },
      },
      "429": {
        description: "Too many requests",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: Str() }),
          },
        },
      },
    },
  };

  async handle(ctx: AppContext) {
    ctx.header("Vary", "Origin, X-Fingerprint");
    ctx.header("Cache-Control", "private, max-age=60, s-maxage=0");
    ctx.header("Content-Type", "application/json; charset=utf-8");

    const origin = ctx.req.header("Origin");
    if (
      origin &&
      !globalThis.allowedOrigins.includes(globalThis.normalizeOrigin(origin))
    ) {
      ctx.status(403);
      return { success: false, error: "origin-not-allowed" };
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const fingerprint = data.headers["x-fingerprint"].trim();

    let host = "";
    try {
      host = new URL(origin).hostname.replace(/:\d+$/u, "");
    } catch {
      host = "";
    }
    const key = `${host}::${fingerprint}`;

    const now = Date.now();
    const until = globalThis.ratelimitCache.get(key);
    if (typeof until === "number" && until > now) {
      const left = Math.max(1, Math.ceil((until - now) / 1000));
      ctx.header("RateLimit-Limit", LIMIT_HEADER);
      ctx.header("RateLimit-Remaining", "0");
      ctx.header("RateLimit-Reset", String(left));
      ctx.header("Retry-After", String(left));
      ctx.status(429);
      return { success: false, error: "rate-limited" };
    }

    globalThis.ratelimitCache.set(key, now + WINDOW_MS);
    ctx.header("RateLimit-Limit", LIMIT_HEADER);
    ctx.header("RateLimit-Remaining", "0");
    ctx.header("RateLimit-Reset", "60");

    const transactionId = crypto.randomUUID();
    const rnd = new Uint8Array(32);
    crypto.getRandomValues(rnd);
    const challenge = toBase64Url(rnd);

    globalThis.txCache.set(transactionId, challenge);

    return {
      success: true,
      result: { transactionId, challenge },
    };
  }
}
