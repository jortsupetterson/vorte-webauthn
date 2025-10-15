import { Bool, Num, Str, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class Challenge extends OpenAPIRoute {
  schema = {
    tags: ["Challenge"],
    summary: `Returns a transaction object with fields "transactionId" and "options"
        so the client can start a fully discoverable WebAuthn assertion flow.`,
    request: {},
    responses: {
      "200": {
        description: "Returns a list of tasks",
        content: {
          "application/json": {
            schema: z.object({
              series: z.object({
                success: Bool(),
                result: z.object({
                  transactionId: Str(),
                  options: z.object({
                    challenge: Str(),
                    rpId: Str(),
                    userVerification: Str(),
                    timeout: Num(),
                  }),
                }),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    const UUIDV4 = crypto.randomUUID();

    // Generate challenge
    const bytes32 = new Uint8Array(32);
    crypto.getRandomValues(bytes32);
    const bytes32binary = String.fromCharCode(...bytes32);
    const bytes32b64 = btoa(bytes32binary);
    const bytes32b64url = bytes32b64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return {
      success: true,
      result: {
        transactionId: UUIDV4,
        options: {
          challenge: bytes32b64url,
          rpId: "vorte.app",
          userVerification: "required",
          timeout: 60000,
        },
      },
    };
  }
}
