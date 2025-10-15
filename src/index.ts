// src/index.ts
import packageJSON from "../package.json";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Challenge } from "./endpoints/challenge";

const app = new Hono<{ Bindings: Env }>({ strict: false });

const openapi = fromHono(app, {
  openapiVersion: "3.1.0",
  docs_url: "/api/v1/webauthn/docs",
  openapi_url: "/api/v1/webauthn/openapi.json",
  schema: {
    info: {
      version: packageJSON.version,
      title: packageJSON.name,
    },
  },
});

openapi.get("/webauthn/challenge", Challenge);

export default app;
