// index.ts
import packageJSON from "../package.json";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Challenge } from "./endpoints/challenge";
import { Register } from "./endpoints/register";

globalThis.allowedOrigins ??= ["http://localhost:8787", "https://vorte.app"];
globalThis.ratelimitCache ??= new Map<string, number>();
globalThis.txCache ??= new Map<string, string>();

globalThis.normalizeOrigin = (origin: string) => {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
};

const app = new Hono<{ Bindings: Env }>({ strict: false });

app.use(
  "/api/v1/*",
  cors({
    origin: (origin) => {
      return origin &&
        globalThis.allowedOrigins.includes(globalThis.normalizeOrigin(origin))
        ? origin
        : "";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Fingerprint"],
    exposeHeaders: [
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After",
      "Cache-Control",
    ],
    maxAge: 600,
  })
);

const openapi = fromHono(app, {
  openapiVersion: "3.1.1",
  docs_url: "/api/v1/webauthn/docs",
  openapi_url: "/api/v1/webauthn/openapi.json",
  schema: {
    info: {
      title: "Vorte Credentials API",
      version: packageJSON.version,
      description: "Public WebAuthn credential API for Vorte ERP",
    },
    servers: [
      { url: "https://vorte.app/api/v1", description: "production" },
      { url: "http://localhost:8787/api/v1", description: "local development" },
    ],
  },
});

openapi.get("/api/v1/webauthn/challenge", Challenge);
openapi.post("/api/v1/webauthn/register", Register);

export default app;
