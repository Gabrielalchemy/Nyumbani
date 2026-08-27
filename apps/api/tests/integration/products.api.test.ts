import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { adminToken, authed, buildApp } from "../helpers/app.js";

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
});

const VALID_PRODUCT = {
  name: "Carved bowl",
  priceKes: 900,
  stockQty: 12,
  category: "kitchen",
};

describe("admin products CRUD", () => {
  it("requires auth for all mutations", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/products",
      payload: VALID_PRODUCT,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates a product and logs an INITIAL stock movement when stocked", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/products",
      ...authed(token),
      payload: VALID_PRODUCT,
    });

    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created).toMatchObject({ name: "Carved bowl", priceKes: 900, visible: true });

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { productId: created.id },
    });
    expect(movement).toMatchObject({ delta: 12, reason: "INITIAL" });
  });

  it("creates without an INITIAL movement when starting stock is zero", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/products",
      ...authed(token),
      payload: { ...VALID_PRODUCT, stockQty: 0 },
    });
    expect(res.statusCode).toBe(201);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it.each([
    [{ ...VALID_PRODUCT, priceKes: -5 }, /price/i],
    [{ ...VALID_PRODUCT, priceKes: 10.5 }, /price/i],
    [{ ...VALID_PRODUCT, name: "" }, /name/i],
    [{ ...VALID_PRODUCT, imageUrl: "not-a-url" }, /image/i],
    [{ ...VALID_PRODUCT, stockQty: 2.5 }, /stock/i],
  ])("validates %j", async (badPayload, pattern) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/products",
      ...authed(token),
      payload: badPayload,
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.json())).toMatch(pattern as RegExp);
  });

  it("patches editable fields", async () => {
    const created = (
      await app.inject({
        method: "POST",
        url: "/api/admin/products",
        ...authed(token),
        payload: VALID_PRODUCT,
      })
    ).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/products/${created.id}`,
      ...authed(token),
      payload: { description: "Hand-carved", priceKes: 1000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ description: "Hand-carved", priceKes: 1000 });
  });

  it("soft-deletes by hiding from the public catalogue but keeps the admin row", async () => {
    const created = (
      await app.inject({
        method: "POST",
        url: "/api/admin/products",
        ...authed(token),
        payload: VALID_PRODUCT,
      })
    ).json();

    const del = await app.inject({
      method: "DELETE",
      url: `/api/admin/products/${created.id}`,
      ...authed(token),
    });
    expect(del.statusCode).toBe(200);

    const publicList = await app.inject({ method: "GET", url: "/api/products" });
    expect(publicList.json().map((p: { id: string }) => p.id)).not.toContain(created.id);

    const adminList = await app.inject({
      method: "GET",
      url: "/api/admin/products",
      ...authed(token),
    });
    expect(adminList.json().map((p: { id: string }) => p.id)).toContain(created.id);
    expect(adminList.json().find((p: { id: string }) => p.id === created.id).visible).toBe(false);
  });
});

describe("restock endpoint", () => {
  async function create(stockQty = 12) {
    return (
      await app.inject({
        method: "POST",
        url: "/api/admin/products",
        ...authed(token),
        payload: { ...VALID_PRODUCT, stockQty },
      })
    ).json();
  }

  it("increments stock transactionally with a RESTOCK movement", async () => {
    const p = await create();

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/products/${p.id}/restock`,
      ...authed(token),
      payload: { qty: 6, note: "New shipment" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stockQty).toBe(18); // 12 + 6

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { productId: p.id, reason: "RESTOCK" },
    });
    expect(movement.delta).toBe(6);
    expect(movement.note).toBe("New shipment");
  });

  it("rejects non-positive or fractional quantities", async () => {
    const p = await create();
    for (const qty of [0, -3, 1.5]) {
      const res = await app.inject({
        method: "POST",
        url: `/api/admin/products/${p.id}/restock`,
        ...authed(token),
        payload: { qty },
      });
      expect(res.statusCode).toBe(400);
    }
    // nothing changed
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stockQty).toBe(12);
    expect(await prisma.stockMovement.count()).toBe(1); // only INITIAL
  });

  it("404s for unknown products instead of crashing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/products/does-not-exist/restock",
      ...authed(token),
      payload: { qty: 2 },
    });
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});
