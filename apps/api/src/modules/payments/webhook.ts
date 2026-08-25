import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { sendSms } from "../../lib/at.js";
import { sms } from "../../lib/templates.js";
import { config } from "../../config.js";

/**
 * Africa's Talking payments notification webhook.
 * Fired when an M-Pesa checkout completes / fails.
 * Payload is flexible — we normalize defensively and stay idempotent.
 */
export async function paymentWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/payments", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const providerRef =
      (body.transactionId as string) ??
      (body.requestId as string) ??
      null;
    const status = String(body.status ?? "").toLowerCase();

    if (!providerRef) {
      req.log.warn({ body }, "payments webhook without transaction reference");
      return reply.code(400).send({ ok: false });
    }

    const payment = await prisma.payment.findUnique({
      where: { providerRef },
      include: { order: true },
    });
    if (!payment) {
      req.log.warn({ providerRef }, "payments webhook for unknown payment");
      return reply.code(200).send({ ok: true, ignored: "unknown-ref" }); // don't retry-storm us
    }

    // Idempotency: never double-apply a completed payment
    if (payment.status === "SUCCESS" || payment.status === "FAILED") {
      return reply.code(200).send({ ok: true, ignored: "already-final" });
    }

    if (!["success", "completed"].includes(status)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", raw: body as object },
      });
      return reply.code(200).send({ ok: true, status: "failed" });
    }

    const amountKes = parseAmount(body.value) ?? payment.amountKes;
    const alreadyPaid = payment.order.depositPaidKes;

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", amountKes, raw: body as object },
      }),
      prisma.order.update({
        where: { id: payment.orderId },
        data: {
          depositPaidKes: alreadyPaid + amountKes,
          status: payment.order.status === "PENDING_PAYMENT" ? "PAID" : undefined,
        },
      }),
    ]);

    const balance = Math.max(payment.order.totalKes - (alreadyPaid + amountKes), 0);
    await sendSms(
      payment.order.customerId ? await phoneOfOrder(payment.orderId) : config.OWNER_PHONE,
      sms.paymentReceived(payment.order.reference, amountKes, balance)
    );

    return reply.code(200).send({ ok: true });
  });
}

async function phoneOfOrder(orderId: string): Promise<string> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true },
  });
  return order.customer.phone;
}

/** AT sends value like "KES 100.00" */
function parseAmount(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(/,/g, "")));
}
