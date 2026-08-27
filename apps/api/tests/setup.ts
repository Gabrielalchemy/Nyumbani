import { AT_API_KEY, DARAJA_CONSUMER_KEY, GEMINI_API_KEY, TEST_DB_URL } from "./db-url.js";

void AT_API_KEY;
void DARAJA_CONSUMER_KEY;
void GEMINI_API_KEY;

/**
 * Runs before each test file's imports are evaluated.
 * - Points Prisma at the isolated test database.
 * - Forces simulation mode for every external integration so tests
 *   never send a real SMS / STK push / AI call even if .env has real keys.
 */
process.env.NODE_ENV = "development";
process.env.DATABASE_URL = TEST_DB_URL;
delete process.env.AT_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.DARAJA_CONSUMER_KEY;
delete process.env.DARAJA_CONSUMER_SECRET;
delete process.env.PUBLIC_BASE_URL;
