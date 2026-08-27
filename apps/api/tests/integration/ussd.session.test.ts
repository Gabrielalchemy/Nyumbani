import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { buildApp } from "../helpers/app.js";
import { config } from "../../src/config.js";

let app: Awaited<ReturnType<typeof buildApp>>;

const SESSION = `sess-${Date.now()}`;
const PHONE_RAW = "254711000010"; // AT strips the "+"

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
});

beforeEach(async () => {
  await resetDb();
});

async function seedCatalogue() {
  // One shared category so list ordering is purely name-asc:
  // page 1 = Acacia, Baobab, Cedar, Dhow + a "Next" option.
  const rows = [
    { name: "Acacia Stool", priceKes: 1200, stockQty: 7 },
    { name: "Baobab Bench", priceKes: 4500, stockQty: 3 },
    { name: "Cedar Table", priceKes: 9800, stockQty: 2 },
    { name: "Dhow Shelf", priceKes: 7200, stockQty: 4 },
    { name: "Ebony Lamp", priceKes: 2600, stockQty: 6 },
  ];
  for (const r of rows) {
    await prisma.product.create({
      data: { ...r, category: "woodwork", lowStockThreshold: 3, visible: true },
    });
  }
  await prisma.product.create({
    data: {
      name: "Hidden Item",
      category: "decor",
      priceKes: 500,
      stockQty: 1,
      visible: false,
    },
  });
}

async function productIdByName(name: string): Promise<string> {
  return (
    await prisma.product.findFirstOrThrow({ where: { name }, select: { id: true } })
  ).id;
}

function ussd(text: string) {
  return app.inject({
    method: "POST",
    url: "/ussd/callback",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      sessionId: SESSION,
      serviceCode: config.USSD_SERVICE_CODE,
      phoneNumber: PHONE_RAW,
      text,
    }).toString(),
  });
}

describe("USSD happy path over HTTP (real DB)", () => {
  it("walks browse → detail → qty → confirm → simulated STK push", async () => {
    await seedCatalogue();

    // ── fresh dial → main menu (CON)
    let res = await ussd("");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body.startsWith("CON")).toBe(true);
    expect(res.body).toContain(config.BUSINESS_NAME);

    // ── 1 → product list, ordered by category then name
    res = await ussd("1");
    expect(res.body).toContain("Products:");
    const orderInText = ["Acacia", "Baobab"].map(
      (n) => res.body.indexOf(n)
    );
    expect(orderInText[0]).toBeLessThan(orderInText[1]); // seating first alphabetically
    expect(res.body).not.toContain("Hidden Item");

    // first page holds 4 items + Next option as item 5
    expect(res.body).toContain("5. Next");
    const sessionPage0 = await prisma.ussdSession.findUniqueOrThrow({ where: { id: SESSION } });
    expect(sessionPage0.screen).toBe("PRODUCT_LIST");

    // ── choose item 1 (Acacia Stool) → detail
    res = await ussd("1*1");
    expect(res.body).toContain("Acacia Stool");
    expect(res.body).toContain("KES 1,200");
    expect(res.body).toContain("1. Order this");

    // ── order it → quantity prompt
    res = await ussd("1*1*1");
    expect(res.body).toContain("Enter quantity:");
    expect(res.body).toContain("Available: 7");

    // invalid quantity re-prompts without losing position
    res = await ussd("1*1*1*abc");
    expect(res.body).toContain("Please enter a valid quantity.");

    // valid qty → confirmation with computed total
    res = await ussd("1*1*1*2");
    expect(res.body).toContain("Confirm your order:");
    expect(res.body).toContain("2 x Acacia Stool");
    expect(res.body).toContain("Total: KES 2,400");

    // ── confirm & pay → END text references M-Pesa prompt
    res = await ussd("1*1*1*2*1");
    expect(res.body.startsWith("END")).toBe(true);
    expect(res.body).toMatch(/NY-[A-Z0-9]{6}/);
    expect(res.body).toContain("M-Pesa");

    // ── database side effects ────────────────────────────────────────
    const phone = "+254711000010"; // normalized E.164 from AT's stripped form

    const customer = await prisma.customer.findUniqueOrThrow({ where: { phone } });
    const order = await prisma.order.findFirstOrThrow({
      where: { customerId: customer.id },
      include: { items: true, payments: true },
    });

    expect(order.channel).toBe("USSD");
    expect(order.status).toBe("PENDING_PAYMENT"); // deposit not yet confirmed by webhook
    expect(order.totalKes).toBe(2400);
    expect(order.items[0].qty).toBe(2);

    // STK simulation recorded an INITIATED payment with a SIM reference
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].status).toBe("INITIATED");
    expect(order.payments[0].providerRef).toContain("SIM-");

    // stock decremented + SALE movement
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: await productIdByName("Acacia Stool") },
    });
    expect(product.stockQty).toBe(5);
    expect(await prisma.stockMovement.count()).toBe(1);

    // session persisted on its final screen
    const finalSession = await prisma.ussdSession.findUniqueOrThrow({ where: { id: SESSION } });
    expect(finalSession.screen).toBe("CONTACT");
    expect(finalSession.phone).toBe(phone);
  });

  it("'arrange payment later' creates the order without a payment row", async () => {
    await seedCatalogue();

    await ussd("");        // home
    await ussd("1");       // list
    await ussd("1*1");     // detail (Acacia)
    await ussd("1*1*1");   // qty prompt
    await ussd("1*1*1*1"); // qty=1
    const res = await ussd("1*1*1*1*2"); // arrange later

    expect(res.body.startsWith("END")).toBe(true);
    expect(res.body).toContain("We'll call you to arrange payment");

    const order = await prisma.order.findFirstOrThrow({ include: { payments: true } });
    expect(order.payments).toHaveLength(0); // no STK initiated
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: await productIdByName("Acacia Stool") },
    });
    expect(product.stockQty).toBe(6); // 7 - 1
  });

  it("incomplete phone-less callbacks are rejected politely", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ussd/callback",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ sessionId: "", phoneNumber: "" }).toString(),
    });
    expect(res.body).toBe("END Invalid request");
  });
});
