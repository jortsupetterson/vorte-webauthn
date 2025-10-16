import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class Register extends OpenAPIRoute {
  schema = {
    tags: ["WebAuthn"],
    summary: "Finalize WebAuthn credential registration",
    request: {
      body: z.object({
        transactionId: z.string().uuid(),
        credential: z.object({
          id: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          response: z.object({
            clientDataJSON: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
            attestationObject: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          }),
        }),
      }),
    },
    responses: {
      "201": {
        description: "Credential successfully registered",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              result: z.object({
                userId: z.string().uuid(),
                credentialId: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
              }),
            }),
          },
        },
      },
      "400": {
        description: "Invalid or missing fields",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
      "429": {
        description: "Too many registration attempts per transaction",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(ctx: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { transactionId, credential } = data.body;
    const challenge = globalThis.txCache.get(transactionId);

    return {};
  }
}
