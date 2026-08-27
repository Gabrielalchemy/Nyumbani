import { prisma } from "../../src/lib/db.js";

const TABLES = [
  "Product",
  "Customer",
  "Order",
  "OrderItem",
  "Payment",
  "StockMovement",
  "Document",
  "Report",
  "OtpCode",
  "UssdSession",
] as const;

export { prisma };

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`
  );
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
