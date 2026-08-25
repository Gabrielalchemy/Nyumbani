import { prisma } from "../../lib/db.js";
import { newOrderReference } from "../../lib/reference.js";
import { sendSms } from "../../lib/at.js";
import { sms } from "../../lib/templates.js";
import { kes } from "../../lib/money.js";
import { config } from "../../config.js";

export interface PlaceOrderInput {
  phone: string;
  items: { productId: string; qty: number }[];
  channel: "USSD" | "WEB";
  note?: string;
  /** true when an M-Pesa deposit prompt is pushed right after placement */
  depositPrompted?: boolean;
}

export interface PlacedOrder {
  id: string;
  reference: string;
  totalKes: number;
}

/**
 * Places an order atomically:
 *  - validates products are visible & in stock
 *  - decrements stock inside a transaction (conditional update → no oversell)
 *  - records StockMovements
 *  - fires SMS to customer + owner, low-stock alert if threshold crossed
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const customer = await prisma.customer.upsert({
    where: { phone: input.phone },
    update: {},
    create: { phone: input.phone },
  });

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, visible: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const p = byId.get(item.productId);
    if (!p) throw new Error("A selected item is no longer available");
    if (!Number.isInteger(item.qty) || item.qty < 1) throw new Error("Invalid quantity");
    if (item.qty > p.stockQty) throw new Error(`Only ${p.stockQty} of ${p.name} left`);
  }

  const totalKes = input.items.reduce(
    (sum, i) => sum + (byId.get(i.productId)?.priceKes ?? 0) * i.qty,
    0
  );

  const result = await prisma.$transaction(async (tx) => {
    // Conditional decrement — guarantees we never oversell under concurrency.
    for (const item of input.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stockQty: { gte: item.qty } },
        data: { stockQty: { decrement: item.qty } },
      });
      if (updated.count === 0) {
        const p = byId.get(item.productId);
        throw new Error(`Just sold out: ${p?.name ?? "item"}. Please adjust your order.`);
      }
    }

    await tx.stockMovement.createMany({
      data: input.items.map((i) => ({
        productId: i.productId,
        delta: -i.qty,
        reason: "SALE",
        note: `Order placed via ${input.channel}`,
      })),
    });

    return tx.order.create({
      data: {
        reference: newOrderReference(),
        customerId: customer.id,
        channel: input.channel,
        note: input.note,
        totalKes,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            unitPriceKes: byId.get(i.productId)!.priceKes,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
  });

  // ── Post-commit notifications ──────────────────────────────────────
  const summary = result.items.map((i) => `${i.qty}× ${i.product.name}`).join(", ");

  await sendSms(
    input.phone,
    sms.orderPlacedCustomer(result.reference, totalKes, input.depositPrompted ?? false)
  );
  await sendSms(config.OWNER_PHONE, sms.newOrderOwner(result.reference, summary, input.phone, totalKes));

  await checkLowStockAlerts(
    input.items.map((i) => ({ productId: i.productId, prevQty: undefined as number | undefined }))
  );

  return { id: result.id, reference: result.reference, totalKes };
}

/**
 * Alerts the owner once per crossing when a product's stock
 * falls to/below its lowStockThreshold.
 */
export async function checkLowStockAlerts(
  items: { productId: string; prevQty?: number }[]
): Promise<void> {
  for (const { productId, prevQty } of items) {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) continue;

    const crossed =
      p.stockQty <= p.lowStockThreshold &&
      (prevQty === undefined || prevQty > p.lowStockThreshold);

    if (crossed) {
      await sendSms(
        config.OWNER_PHONE,
        sms.lowStockOwner(p.name, p.stockQty, p.lowStockThreshold)
      );
    }
  }
}
