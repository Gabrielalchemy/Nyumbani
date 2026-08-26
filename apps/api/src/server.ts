import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import jwt from "@fastify/jwt";
import { config, isProd } from "./config.js";
import { prisma } from "./lib/db.js";
import { mpesaConfigured } from "./lib/mpesa.js";
import { publicProductRoutes, adminProductRoutes } from "./modules/products/routes.js";
import { adminOrderRoutes } from "./modules/orders/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { ussdRoutes } from "./modules/ussd/handler.js";
import { paymentWebhookRoutes } from "./modules/payments/webhook.js";
import { adminInsightRoutes } from "./modules/insights/documents.js";
import { adminReportRoutes } from "./modules/insights/reports.js";
import { webOrderRoutes } from "./modules/orders/web.js";
import { publicMetaRoutes } from "./modules/meta/routes.js";

const app = Fastify({
  logger: isProd
    ? true
    : {
        transport: undefined,
        level: "info",
      },
  trustProxy: true,
  bodyLimit: 12 * 1024 * 1024,
});

await app.register(cors, { origin: true });
await app.register(multipart);
await app.register(jwt, { secret: config.JWT_SECRET });

// Africa's Talking posts USSD callbacks as x-www-form-urlencoded
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

// ── Health ────────────────────────────────────────────────────────────
app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return {
    ok: true,
    service: config.BUSINESS_NAME,
    env: config.NODE_ENV,
    at: config.AT_API_KEY ? "configured" : "simulated",
    ai: config.GEMINI_API_KEY ? "configured" : "simulated",
    mpesa: mpesaConfigured() ? "configured" : "simulated",
    time: new Date().toISOString(),
  };
});

// ── Public API ────────────────────────────────────────────────────────
await app.register(authRoutes, { prefix: "/api" });
await app.register(publicProductRoutes, { prefix: "/api" });
await app.register(webOrderRoutes, { prefix: "/api" });
await app.register(publicMetaRoutes, { prefix: "/api" });

// ── Admin API (JWT-guarded) ───────────────────────────────────────────
await app.register(adminProductRoutes, { prefix: "/api/admin" });
await app.register(adminOrderRoutes, { prefix: "/api/admin" });
await app.register(adminInsightRoutes, { prefix: "/api/admin" });
await app.register(adminReportRoutes, { prefix: "/api/admin" });

// ── Africa's Talking callbacks ────────────────────────────────────────
await app.register(ussdRoutes, { prefix: "/ussd" });
await app.register(paymentWebhookRoutes);

// ── Serve built SPA in production ─────────────────────────────────────
const c1 = resolve(process.cwd(), "../web/dist");
const c2 = resolve(process.cwd(), "apps/web/dist");
const webDist = existsSync(c1) ? c1 : existsSync(c2) ? c2 : null;

if (webDist) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url ?? "";
    if (
      url.startsWith("/api") ||
      url.startsWith("/ussd") ||
      url.startsWith("/webhooks")
    ) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received — shutting down`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Nyumbani API ready on :${config.PORT} (${config.AT_ENVIRONMENT})`);
  if (config.PUBLIC_BASE_URL) {
    const base = config.PUBLIC_BASE_URL.replace(/\/+$/, "");
    console.log(`
──────────────── Callback URLs for provider portals ────────────────
  Africa's Talking USSD:   ${base}/ussd/callback
  Africa's Talking payments: ${base}/webhooks/payments   (legacy)
  Daraja M-Pesa STK:       ${base}/webhooks/mpesa
─────────────────────────────────────────────────────────────────────`);
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
