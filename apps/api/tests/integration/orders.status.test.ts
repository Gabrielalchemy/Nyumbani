import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { sendSms } from "../../src/lib/at.js";
import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { buildApp, adminToken, authed } from "../helpers/app.js";

const smsSpy = vi.mocked(sendSms);

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  token = adminToken(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
});

beforeEach(async () => {
  await resetDb();
  smsSpy.mockClear();
});

async function seedPaidOrder() {
  const product = await prisma.product.create({
    data: { name: "Bench", priceKes: 4000, stockQty: 5 },
  });
  const customer = await prisma.customer.create({
    data: { phone: "+254722000007" },
  });
  return prisma.order.create({
    data: {
      reference: "NY-STATUS1",
      customerId: customer.id,
      status: "PAID",
      channel: "WEB",
      totalKes: 8000,
      items: { create: [{ productId: product.id, qty: 2, unitPriceKes: 4000 }] },
    },
  });
}

describe("PATCH /api/admin/orders/:id/status", () => {
  it("requires auth", async () => {
    const order = await seedPaidOrder();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/orders/${order.id}/status`,
      payload: { status: "READY" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("advances the status and texts the customer", async () => {
    const order = await seedPaidOrder();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/orders/${order.id}/status`,
      ...authed(token),
      payload: { status: "IN_PRODUCTION" },
    });

    expect(res.statusCode).toBe(200);
    const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.status).toBe("IN_PRODUCTION");

    expect(smsSpy).toHaveBeenCalledTimes(1);
    expect(smsSpy.mock.calls[0][0]).toBe("+254722000007");
    expect(smsSpy.mock.calls[0][1]).toContain("NY-STATUS1");
    expect(smsSpy.mock.calls[0][1]).toContain("In production");
  });

  it("cancelling returns stock transactionally with a RESTOCK movement", async () => {
    const order = await seedPaidOrder(); // item qty 2 on a Bench stocked at 5
    const productId = (
      await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
    ).productId;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/orders/${order.id}/status`,
      ...authed(token),
      payload: { status: "CANCELLED" },
    });
    expect(res.statusCode).toBe(200);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(after.stockQty).toBe(7); // 5 + 2 returned

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { productId },
    });
    expect(movement.delta).toBe(2);
    expect(movement.reason).toBe("RESTOCK");
    expect(movement.note).toContain("NY-STATUS1");

    // single cancellation SMS
    expect(smsSpy).toHaveBeenCalledTimes(1);
    expect(smsSpy.mock.calls[0][1]).toContain("Cancelled");
  });

  it("does not double-restock when already cancelled", async () => {
    const order = await seedPaidOrder();
    for (const _ of [1, 2]) {
      await app.inject({
        method: "PATCH",
        url: `/api/admin/orders/${order.id}/status`,
        ...authed(token),
        payload: { status: "CANCELLED" },
      });
      void _;
    }

    const movements = await prisma.stockMovement.count({ where: { reason: "RESTOCK" } });
    expect(movements).toBe(1);

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
    expect(after.stockQty).toBe(7);
  });

  it("rejects unknown statuses and does not text anything", async () => {
    const order = await seedPaidOrder();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/orders/${order.id}/status`,
      ...authed(token),
      payload: { status: "TELEPORTED" },
    });
    expect(res.statusCode).toBe(400);
    expect(smsSpy).not.toHaveBeenCalled();

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe("PAID");
  });

  it("skips the SMS when transitioning to the same status", async () => {
    const order = await seedPaidOrder(); // already PAID
    await app.inject({
      method: "PATCH",
      url: `/api/admin/orders/${order.id}/status`,
      ...authed(token),
      payload: { status: "PAID" },
    });
    expect(smsSpy).not.toHaveBeenCalled();
  });
});
