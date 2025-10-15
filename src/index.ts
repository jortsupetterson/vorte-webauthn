// src/index.ts
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Challenge } from "./endpoints/challenge";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  openapiVersion: "3.1",
  docs_url: "/api/v1/webauthn",
});

// WebAuthn: fully discoverable assertion init
openapi.get("/api/v1/webauthn/challenge", Challenge);

export default app;
