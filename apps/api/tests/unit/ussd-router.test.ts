import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Unit matrix for the USSD state machine router.
 * Prisma is fully mocked; the USSD ↔ payment integration is covered live
 * by tests/integration/ussd.session.test.ts.
 */

vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    ussdSession: {
      upsert: vi.fn(),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(async () => null),
    },
  },
}));

import { prisma } from "../../src/lib/db.js";
import { handleUssd } from "../../src/modules/ussd/service.js";
import { config } from "../../src/config.js";

const mocked = vi.mocked(prisma, true);
type AnyRow = Record<string, unknown>;

function product(id: string, overrides: AnyRow = {}): AnyRow {
  return {
    id,
    name: `Item ${id}`,
    description: "Nice",
    category: "chairs",
    priceKes: 1500,
    stockQty: 10,
    lowStockThreshold: 3,
    imageUrl: null,
    visible: true,
    ...overrides,
  };
}

const SESSION_ID = "unit-session";

/** Drive one AT callback; AT sends the full *-joined history. */
async function send(text: string, existing?: { screen: string; data?: AnyRow }) {
  const row = {
    id: SESSION_ID,
    phone: "+254711223344",
    screen: existing?.screen ?? "MAIN",
    data: (existing?.data ?? {}) as object,
  };
  mocked.ussdSession.upsert.mockResolvedValue(row as never);

  const updatedScreens: string[] = [];
  mocked.ussdSession.update.mockImplementation(async ({ data }: never) => {
    updatedScreens.push((data as { screen: string }).screen);
    return { ...row, ...(data as object) } as never;
  });

  const response = await handleUssd({
    sessionId: SESSION_ID,
    phoneNumber: "+254711223344",
    text,
  });

  return { response, updatedScreens };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("USSD router", () => {
  it("renders the main menu for a fresh session", async () => {
    const { response } = await send("");
    expect(response.startsWith("CON")).toBe(true);
    expect(response).toContain(`Karibu ${config.BUSINESS_NAME}`);
    expect(response).toContain("1. Browse products");
    expect(response).toContain("2. My orders");
    expect(response).toContain("3. Contact us");
  });

  it("pages the catalogue: 4 items then a Next option", async () => {
    mocked.product.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((n) => product(`p${n}`)) as never
    );

    const { response } = await send("1");
    expect(response.startsWith("CON")).toBe(true);
    expect(response).toContain("Products:");
    expect(response).toContain("1. Item p1 - KES 1,500");
    expect(response).not.toContain("Item p5 -");
    expect(response).toContain("5. Next");

    // persisted page cursor
    expect(mocked.ussdSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { screen: "PRODUCT_LIST", data: { page: 0 } } })
    );
  });

  it("advances pagination when Next is chosen", async () => {
    mocked.product.findMany.mockClear().mockResolvedValue(
      [1, 2, 3, 4, 5].map((n) => product(`p${n}`)) as never
    );
    await send("5", { screen: "PRODUCT_LIST", data: { page: 0 } });

    expect(mocked.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4 })
    );
    expect(mocked.ussdSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { screen: "PRODUCT_LIST", data: { page: 1 } } })
    );
  });

  it("shows product detail with stock line and navigation keys", async () => {
    mocked.product.findMany.mockResolvedValue([product("p1")] as never);
    mocked.product.findUnique.mockResolvedValue(
      product("p1", { stockQty: 12 }) as never
    );

    const { response } = await send("1", { screen: "PRODUCT_LIST", data: { page: 0 } });
    expect(response).toContain("Item p1");
    expect(response).toContain("KES 1,500");
    expect(response).toContain("12 available");
    expect(response).toContain("1. Order this");
    expect(response).toContain("9. Back");
    expect(response).toContain("0. Main menu");
  });

  it("Back on detail returns to remembered catalogue page", async () => {
    mocked.product.findMany.mockResolvedValue([product("p9")] as never);

    const { response } = await send("9", {
      screen: "PRODUCT_DETAIL",
      data: { productId: "p1", lastPage: 2 },
    });
    expect(response).toContain("Products:");
    expect(mocked.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 8 })
    );
  });

  it("rejects invalid quantity and out-of-stock quantities", async () => {
    const p = product("p1", { stockQty: 3 });
    mocked.product.findUnique.mockResolvedValue(p as never);

    const badInput = await send("abc", { screen: "ORDER_QTY", data: { productId: "p1" } });
    expect(badInput.response).toContain("Please enter a valid quantity.");

    const tooMany = await send("5", { screen: "ORDER_QTY", data: { productId: "p1" } });
    expect(tooMany.response).toContain("Sorry, only 3 available.");
  });

  it("confirm screen shows total and supports Home key", async () => {
    mocked.product.findUnique.mockResolvedValue(product("p1") as never);

    const confirm = await send("", {
      screen: "ORDER_CONFIRM",
      data: { productId: "p1", qty: 2 },
    });
    expect(confirm.response).toContain("Confirm your order:");
    expect(confirm.response).toContain("2 x Item p1");
    expect(confirm.response).toContain("Total: KES 3,000");

    const home = await send("0", {
      screen: "ORDER_CONFIRM",
      data: { productId: "p1", qty: 2 },
    });
    expect(home.response).toContain(`Karibu ${config.BUSINESS_NAME}`);
  });

  it("'My orders' for an unknown customer shows the empty state", async () => {
    const { response } = await send("2");
    expect(response).toContain("You have no orders yet.");
    expect(mocked.ussdSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ screen: "MY_ORDERS" }) })
    );
  });

  it("unknown selection falls back gracefully instead of crashing", async () => {
    const { response } = await send("99");
    expect(response.startsWith("CON")).toBe(true);
    expect(response).toContain("Browse products");
  });
});
