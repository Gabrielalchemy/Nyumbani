import type { FastifyInstance } from "fastify";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../../lib/db.js";
import { requireAdmin } from "../auth/routes.js";
import { config } from "../../config.js";
import { sendSms } from "../../lib/at.js";
import { kes } from "../../lib/money.js";

interface ReportMetrics {
  periodLabel: string;
  revenueBookedKes: number;
  cashCollectedKes: number;
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  topProducts: { name: string; qtySold: number; revenueKes: number }[];
  expenses: {
    totalKes: number;
    byCategory: Record<string, number>;
    bySupplier: { supplier: string; amountKes: number }[];
  };
  stock: {
    skusTracked: number;
    lowStockItems: { name: string; qty: number }[];
    inventoryValueKes: number;
  };
}

export async function adminReportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.post("/reports/generate", async (_req, reply) => {
    const metrics = await computeMetrics();
    const narrative = await narrate(metrics);
    const report = await prisma.report.create({
      data: {
        periodLabel: metrics.periodLabel,
        metrics: metrics as object,
        narrative,
      },
    });
    return reply.code(201).send(report);
  });

  app.get("/reports", async () =>
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  );

  /** Condensed SMS digest of the latest report → owner's phone. */
  app.post("/reports/:id/send-sms", async (req, reply) => {
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: (req.params as { id: string }).id },
    });
    const digest = smsDigest(report.narrative, report.metrics as unknown as ReportMetrics);
    const result = await sendSms(config.OWNER_PHONE, digest);
    return reply.send({ ok: result.ok, simulated: result.simulated });
  });
}

async function computeMetrics(): Promise<ReportMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orders, orderItems, docs, products] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      include: { items: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, status: { not: "CANCELLED" } } },
      include: { product: { select: { name: true } } },
    }),
    prisma.document.findMany({ where: { status: "PROCESSED" } }),
    prisma.product.findMany({ orderBy: { stockQty: "asc" } }),
  ]);

  const revenueBookedKes = orders.reduce((s, o) => s + o.totalKes, 0);
  const cashCollectedKes = orders.reduce((s, o) => s + o.depositPaidKes, 0);

  const ordersByStatus: Record<string, number> = {};
  for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;

  const productAgg = new Map<string, { qty: number; revenue: number }>();
  for (const item of orderItems) {
    const cur = productAgg.get(item.product.name) ?? { qty: 0, revenue: 0 };
    cur.qty += item.qty;
    cur.revenue += item.unitPriceKes * item.qty;
    productAgg.set(item.product.name, cur);
  }
  const topProducts = [...productAgg.entries()]
    .map(([name, v]) => ({ name, qtySold: v.qty, revenueKes: v.revenue }))
    .sort((a, b) => b.revenueKes - a.revenueKes)
    .slice(0, 5);

  let expensesTotal = 0;
  const byCategory: Record<string, number> = {};
  const supplierAgg = new Map<string, number>();
  for (const doc of docs) {
    const ex = doc.extracted as
      | { totalAmount?: number; category?: string; currency?: string; supplier?: string }
      | null;
    if (!ex || typeof ex.totalAmount !== "number") continue;
    if ((ex.currency ?? "KES") !== "KES") continue;
    expensesTotal += ex.totalAmount;
    const cat = ex.category ?? "other";
    byCategory[cat] = (byCategory[cat] ?? 0) + ex.totalAmount;
    const sup = ex.supplier ?? "Unknown";
    supplierAgg.set(sup, (supplierAgg.get(sup) ?? 0) + ex.totalAmount);
  }

  return {
    periodLabel: `Last 30 days (from ${since.toISOString().slice(0, 10)})`,
    revenueBookedKes,
    cashCollectedKes,
    ordersTotal: orders.length,
    ordersByStatus,
    topProducts,
    expenses: {
      totalKes: expensesTotal,
      byCategory,
      bySupplier: [...supplierAgg.entries()]
        .map(([supplier, amountKes]) => ({ supplier, amountKes }))
        .sort((a, b) => b.amountKes - a.amountKes)
        .slice(0, 5),
    },
    stock: {
      skusTracked: products.length,
      lowStockItems: products
        .filter((p) => p.stockQty <= p.lowStockThreshold)
        .map((p) => ({ name: p.name, qty: p.stockQty })),
      inventoryValueKes: products.reduce((s, p) => s + p.stockQty * p.priceKes, 0),
    },
  };
}

async function narrate(m: ReportMetrics): Promise<string> {
  const fallback = [
    `${m.periodLabel}: booked ${kes(m.revenueBookedKes)} across ${m.ordersTotal} orders; collected ${kes(m.cashCollectedKes)} in deposits.`,
    m.topProducts[0]
      ? `Top seller: ${m.topProducts[0].name} (${m.topProducts[0].qtySold} sold, ${kes(m.topProducts[0].revenueKes)}).`
      : "No sales recorded yet.",
    m.expenses.totalKes > 0
      ? `Recorded expenses: ${kes(m.expenses.totalKes)}.`
      : "No expenses on file yet — upload invoices to unlock expense insights.",
    m.stock.lowStockItems.length > 0
      ? `${m.stock.lowStockItems.length} item(s) need restocking.`
      : "Stock levels healthy.",
  ].join(" ");

  if (!config.GEMINI_API_KEY) return fallback;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: [
        "You are a sharp, encouraging business advisor for a small Kenyan manufacturer.",
        "Write a concise business report (max ~180 words, plain text, no markdown).",
        "Structure: one-line headline, then performance, expenses, stock, and ONE concrete recommended action for the coming week.",
        "Be specific with numbers. Warm but direct tone.",
        "",
        `Metrics JSON: ${JSON.stringify(m)}`,
      ].join("\n"),
    });
    return text.trim();
  } catch (err) {
    console.error("[report narration failed]", err);
    return fallback;
  }
}

function smsDigest(narrative: string, m: ReportMetrics): string {
  const head = `Business report (${m.periodLabel}):`;
  const core = `Revenue ${kes(m.revenueBookedKes)} | Collected ${kes(m.cashCollectedKes)} | Orders ${m.ordersTotal} | Expenses ${kes(m.expenses.totalKes)}`;
  const action =
    m.stock.lowStockItems.length > 0
      ? ` Restock soon: ${m.stock.lowStockItems.slice(0, 3).map((i) => i.name).join(", ")}.`
      : "";
  const body = core.length + head.length < 300 ? core : narrative.slice(0, 280);
  return `${head} ${body}${action} - ${config.BUSINESS_NAME}`;
}
