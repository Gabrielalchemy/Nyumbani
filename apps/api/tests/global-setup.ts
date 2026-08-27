import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { ADMIN_DB_URL, API_DIR, TEST_DB_URL, DEV_DB_URL } from "./db-url.js";

export async function setup(): Promise<void> {
  await ensureTestDatabase();
  // Apply the committed migrations to nyumbani_test (idempotent).
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}

async function ensureTestDatabase(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: ADMIN_DB_URL } },
  });
  try {
    const dbName = new URL(TEST_DB_URL).pathname.replace(/^\//, "");
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`[tests] created database ${dbName}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) {
      throw new Error(
        `[tests] could not reach Postgres or create the test database.\n` +
          `        Admin URL: ${ADMIN_DB_URL}\n` +
          `        Dev URL:   ${DEV_DB_URL}\n` +
          `        Start Postgres first (docker compose up -d db) — original error: ${msg}`
      );
    }
  } finally {
    await admin.$disconnect();
  }
}
