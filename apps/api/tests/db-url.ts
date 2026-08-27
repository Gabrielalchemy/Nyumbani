import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the development and test database URLs.
 * Tests never touch the dev database — same server, separate `nyumbani_test`
 * database derived from whatever DATABASE_URL is configured.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
export const API_DIR = resolve(HERE, "..");
export const REPO_ROOT = resolve(API_DIR, "..", "..");

const FALLBACK_DEV_URL = "postgresql://nyumbani:nyumbani@localhost:5433/nyumbani";
const TEST_DB_NAME = "nyumbani_test";

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function loadDevUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("://")) {
    return process.env.DATABASE_URL;
  }
  let dir = REPO_ROOT;
  for (let i = 0; i < 3; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      const parsed = parseEnvFile(readFileSync(candidate, "utf8"));
      if (parsed.DATABASE_URL?.includes("://")) return parsed.DATABASE_URL;
      break;
    }
    dir = resolve(dir, "..");
  }
  return FALLBACK_DEV_URL;
}

function swapDbName(url: string, dbName: string): string {
  try {
    const u = new URL(url);
    u.pathname = `/${dbName}`;
    return u.toString();
  } catch {
    return `postgresql://nyumbani:nyumbani@localhost:5433/${dbName}`;
  }
}

export const DEV_DB_URL = loadDevUrl();
export const TEST_DB_URL = swapDbName(DEV_DB_URL, TEST_DB_NAME);
export const ADMIN_DB_URL = swapDbName(TEST_DB_URL, "postgres");
