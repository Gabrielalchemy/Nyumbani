import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { sendSms } from "../../src/lib/at.js";
import { placeOrder } from "../../src/modules/orders/service.js";
import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { config } from "../../src/config.js";

const smsSpy = vi.mocked(sendSms);

beforeEach(async () => {
  await resetDb();
  smsSpy.mockClear();
});

async function seedProduct(overrides: Record<string, unknown> = {}) {
  return prisma.product.create({
    data: {
      name: "Stool",
      priceKes: 1500,
      stockQty: 10,
      lowStockThreshold: 3,
      ...overrides,
    },
  });
}

describe("placeOrder", () => {
  it("creates the customer, decrements stock atomically and logs SALE movements", async () => {
    const p = await seedProduct({ stockQty: 10 });
    const order = await placeOrder({
      phone: "+254711000001",
      items: [{ productId: p.id, qty: 2 }],
      channel: "WEB",
    });

    expect(order.reference).toMatch(/^NY-[A-Z0-9]{6}$/);
    expect(order.totalKes).toBe(3000);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stockQty).toBe(8);

    const movements = await prisma.stockMovement.findMany({ where: { productId: p.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ delta: -2, reason: "SALE" });

    const dbOrder = await prisma.order.findUniqueOrThrow({
      where: { reference: order.reference },
      include: { items: true, customer: true },
    });
    expect(dbOrder.status).toBe("PENDING_PAYMENT");
    expect(dbOrder.channel).toBe("WEB");
    expect(dbOrder.customer.phone).toBe("+254711000001");
    expect(dbOrder.items[0]).toMatchObject({ qty: 2, unitPriceKes: 1500 });
  });

  it("texts both the customer and the owner", async () => {
    const p = await seedProduct();
    await placeOrder({
      phone: "+254711000002",
      items: [{ productId: p.id, qty: 1 }],
      channel: "USSD",
    });

    const recipients = smsSpy.mock.calls.map((c) => c[0]);
    expect(recipients).toContain("+254711000002");
    expect(recipients).toContain(config.OWNER_PHONE);
    // first SMS is the order confirmation
    expect(smsSpy.mock.calls[0][1]).toContain("Asante!");
  });

  it("fires exactly one low-stock alert when crossing the threshold", async () => {
    const p = await seedProduct({ stockQty: 5, lowStockThreshold: 3 });
    await placeOrder({
      phone: "+254711000003",
      items: [{ productId: p.id, qty: 3 }],
      channel: "USSD",
    }); // 5 → 2, crosses threshold of 3

    const alerts = smsSpy.mock.calls.filter(([, text]) => text.includes("Stock alert"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0][0]).toBe(config.OWNER_PHONE);
    expect(alerts[0][1]).toContain("Stool");
    expect(alerts[0][1]).toContain("only 2 left");
  });

  it("does not alert when stock stays above threshold", async () => {
    const p = await seedProduct({ stockQty: 10, lowStockThreshold: 3 });
    await placeOrder({
      phone: "+254711000004",
      items: [{ productId: p.id, qty: 2 }],
      channel: "USSD",
    });

    expect(smsSpy.mock.calls.filter(([, t]) => t.includes("Stock alert"))).toHaveLength(0);
  });

  it("refuses to oversell and leaves stock untouched", async () => {
    const p = await seedProduct({ stockQty: 3 });
    await expect(
      placeOrder({
        phone: "+254711000005",
        items: [{ productId: p.id, qty: 4 }],
        channel: "WEB",
      })
    ).rejects.toThrow(/Only 3 of Stool left/);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stockQty).toBe(3);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("rejects invisible products as unavailable", async () => {
    const p = await seedProduct({ visible: false });
    await expect(
      placeOrder({
        phone: "+254711000006",
        items: [{ productId: p.id, qty: 1 }],
        channel: "WEB",
      })
    ).rejects.toThrow(/no longer available/);
  });

  it("survives concurrent buyers without overselling (only one wins qty=1 on stock=1)", async () => {
    const p = await seedProduct({ stockQty: 1 });

    const attempts = Array.from({ length: 2 }, (_, i) =>
      placeOrder({
        phone: `+25471100001${i}`,
        items: [{ productId: p.id, qty: 1 }],
        channel: "WEB",
      })
    );
    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === "rejected") {
      expect(String(rejected[0].reason?.message ?? rejected[0].reason)).toMatch(
        /Just sold out|left/
      );
    }

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stockQty).toBe(0); // never negative
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.stockMovement.count()).toBe(1);
  });
});
