import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { placeOrder } from "./service.js";
import { mobileCheckout } from "../../lib/at.js";
import { normalizeKenyanPhone } from "../../lib/phone.js";

const webOrderSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(99),
  phone: z.string().min(9),
  note: z.string().max(500).optional(),
});

/** Public: order from the website → M-Pesa deposit push to customer's phone. */
export async function webOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post("/orders/web", async (req, reply) => {
    const parsed = webOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid order", details: parsed.error.flatten() });
    }

    let phone: string;
    try {
      phone = normalizeKenyanPhone(parsed.data.phone);
    } catch {
      return reply.code(400).send({ error: "Please enter a valid Kenyan phone number" });
    }

    try {
      const order = await placeOrder({
        phone,
        items: [{ productId: parsed.data.productId, qty: parsed.data.qty }],
        channel: "WEB",
        note: parsed.data.note,
        depositPrompted: true,
      });

      const checkout = await mobileCheckout({
        phoneNumber: phone,
        amountKes: order.totalKes,
        metadata: { orderRef: order.reference, purpose: "deposit", channel: "web" },
      });

      if (checkout.ok && checkout.data?.transactionId) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            providerRef: checkout.data.transactionId,
            amountKes: order.totalKes,
            method: "MPESA",
            status: "INITIATED",
          },
        });
      } else if (!checkout.ok) {
        return reply.code(201).send({
          reference: order.reference,
          totalKes: order.totalKes,
          checkoutPushed: false,
          message:
            "Your order is confirmed. We'll contact you shortly to arrange payment.",
        });
      }

      return reply.code(201).send({
        reference: order.reference,
        totalKes: order.totalKes,
        checkoutPushed: true,
        message:
          "We've sent an M-Pesa prompt to your phone. Enter your PIN to confirm the deposit.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not place order";
      return reply.code(409).send({ error: msg });
    }
  });
}
