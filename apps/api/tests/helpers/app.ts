import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { config } from "../../src/config.js";
import { authRoutes } from "../../src/modules/auth/routes.js";
import { publicProductRoutes, adminProductRoutes } from "../../src/modules/products/routes.js";
import { adminOrderRoutes } from "../../src/modules/orders/routes.js";
import { webOrderRoutes } from "../../src/modules/orders/web.js";
import { publicMetaRoutes } from "../../src/modules/meta/routes.js";
import { ussdRoutes } from "../../src/modules/ussd/handler.js";
import { paymentWebhookRoutes } from "../../src/modules/payments/webhook.js";

/**
 * Builds the same route topology as src/server.ts (minus insights/static)
 * for fastify.inject()-based integration tests — no sockets involved.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(jwt, { secret: config.JWT_SECRET });

  // Same parser server.ts registers for Africa's Talking callbacks
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(publicProductRoutes, { prefix: "/api" });
  await app.register(webOrderRoutes, { prefix: "/api" });
  await app.register(publicMetaRoutes, { prefix: "/api" });
  await app.register(adminProductRoutes, { prefix: "/api/admin" });
  await app.register(adminOrderRoutes, { prefix: "/api/admin" });
  await app.register(ussdRoutes, { prefix: "/ussd" });
  await app.register(paymentWebhookRoutes);

  return app;
}

/** Sign a valid admin JWT for guard-protected routes. */
export function adminToken(app: FastifyInstance): string {
  return app.jwt.sign({ role: "admin", phone: config.OWNER_PHONE }, { expiresIn: "1h" });
}

export function authed(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}
