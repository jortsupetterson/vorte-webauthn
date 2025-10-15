import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Challenge } from "./endpoints/challenge";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/v1/webauthn/challenge", Challenge);

export default app;
