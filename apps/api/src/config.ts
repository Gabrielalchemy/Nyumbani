import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Tiny zero-dependency .env loader (walks up to repo root). */
function loadDotEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m || m[1].startsWith("#")) continue;
        let value = m[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(m[1] in process.env)) process.env[m[1]] = value;
      }
      break;
    }
    dir = resolve(dir, "..");
  }
}
loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8).default("nyumbani-dev-secret-change-me"),

  BUSINESS_NAME: z.string().min(1).default("Nyumbani"),
  BUSINESS_TAGLINE: z.string().default("Quality goods, made to order"),
  OWNER_PHONE: z.string().default("+254700000000"),
  USSD_SERVICE_CODE: z.string().default("*384*0000#"),

  AT_USERNAME: z.string().default("sandbox"),
  AT_API_KEY: z.string().default(""),
  AT_SENDER_ID: z.string().default(""),
  AT_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  AT_CHECKOUT_PRODUCT: z.string().default("DefaultProduct"),

  GEMINI_API_KEY: z.string().default(""),
});

export const config = envSchema.parse(process.env);
export const isProd = config.NODE_ENV === "production";
