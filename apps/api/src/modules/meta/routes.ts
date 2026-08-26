import type { FastifyInstance } from "fastify";
import { config } from "../../config.js";

/** Public branding/config consumed by the storefront SPA. */
export async function publicMetaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/config",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              businessName: { type: "string" },
              businessTagline: { type: "string" },
              ussdServiceCode: { type: "string" },
              ownerPhone: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({
      businessName: config.BUSINESS_NAME,
      businessTagline: config.BUSINESS_TAGLINE,
      ussdServiceCode: config.USSD_SERVICE_CODE,
      ownerPhone: config.OWNER_PHONE,
    })
  );
}
