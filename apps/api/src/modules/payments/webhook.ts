import type { FastifyInstance } from "fastify";
import type { Payment, Order } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { sendSms } from "../../lib/at.js";
import { sms } from "../../lib/templates.js";
import { config } from "../../config.js";

/**
 * Payment result webhooks.
 *  - POST /webhooks/payments  — legacy Africa's Talking payments notification
 *  - POST /webhooks/mpesa     — Safaricom Daraja STK push result
 * Both normalize into the same idempotent finalization.
 */
export async function paymentWebhookRoutes(app: FastifyInstance): Promise<void> {
  // ── Africa's Talking (retired checkout; kept for compatibility) ─────
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

    if (!["success", "completed"].includes(status)) {
      await finalizePayment(payment, payment.order, { ok: false, amountKes: payment.amountKes, raw: body });
      return reply.code(200).send({ ok: true, status: "failed" });
    }

    const amountKes = parseAmount(body.value) ?? payment.amountKes;
    await finalizePayment(payment, payment.order, { ok: true, amountKes, raw: body });
    return reply.code(200).send({ ok: true });
  });

  // ── Safaricom Daraja STK result ──────────────────────────────────────
  app.post("/webhooks/mpesa", async (req, reply) => {
    const body = (req.body ?? {}) as MpesaCallbackBody;
    const cb = body.Body?.stkCallback;

    if (!cb?.CheckoutRequestID) {
      req.log.warn({ body }, "mpesa callback without CheckoutRequestID");
      // Always acknowledge so Daraja doesn't retry
      return reply.code(200).send({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const payment = await prisma.payment.findUnique({
      where: { providerRef: cb.CheckoutRequestID },
      include: { order: true },
    });
    if (!payment) {
      req.log.warn({ checkoutRequestId: cb.CheckoutRequestID }, "mpesa callback for unknown payment");
      return reply.code(200).send({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const meta = metadataMap(cb);
    const amountKes = num(meta.get("Amount")) ?? payment.amountKes;
    const raw = { ...cb, mpesaReceiptNumber: meta.get("MpesaReceiptNumber") ?? null };

    await finalizePayment(payment, payment.order, {
      ok: cb.ResultCode === 0,
      amountKes,
      raw,
    });

    return reply.code(200).send({ ResultCode: 0, ResultDesc: "Accepted" });
  });
}

// ── Shared finalization (idempotent) ───────────────────────────────────

async function finalizePayment(
  payment: Payment,
  order: Order,
  result: { ok: boolean; amountKes: number; raw: object }
): Promise<void> {
  // Never double-apply a completed payment
  if (payment.status === "SUCCESS" || payment.status === "FAILED") return;

  if (!result.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", raw: result.raw },
    });
    return;
  }

  const alreadyPaid = order.depositPaidKes;
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", amountKes: result.amountKes, raw: result.raw },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        depositPaidKes: alreadyPaid + result.amountKes,
        status: order.status === "PENDING_PAYMENT" ? "PAID" : undefined,
      },
    }),
  ]);

  const balance = Math.max(order.totalKes - (alreadyPaid + result.amountKes), 0);
  const phone = order.customerId
    ? (await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { customer: true } })).customer.phone
    : config.OWNER_PHONE;
  await sendSms(phone, sms.paymentReceived(order.reference, result.amountKes, balance));
}

// ── Daraja payload helpers ─────────────────────────────────────────────

interface MpesaCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: unknown }[] };
    };
  };
}

function metadataMap(cb: NonNullable<NonNullable<MpesaCallbackBody["Body"]>["stkCallback"]>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const item of cb.CallbackMetadata?.Item ?? []) {
    if (item.Name) map.set(item.Name, item.Value);
  }
  return map;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/** AT sends value like "KES 100.00" */
function parseAmount(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(/,/g, "")));
}
