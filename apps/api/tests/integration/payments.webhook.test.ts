import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { sendSms } from "../../src/lib/at.js";
import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { buildApp } from "../helpers/app.js";

const smsSpy = vi.mocked(sendSms);

let app: Awaited<ReturnType<typeof buildApp>>;

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
  smsSpy.mockClear();
});

interface Fixture {
  orderRef: string;
  providerRef: string;
  customerPhone: string;
}

async function seedPendingPayment(orderTotal: number): Promise<Fixture> {
  const customer = await prisma.customer.create({
    data: { phone: "+254733000008" },
  });
  const order = await prisma.order.create({
    data: {
      reference: "NY-PAYTEST",
      customerId: customer.id,
      status: "PENDING_PAYMENT",
      channel: "USSD",
      totalKes: orderTotal,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      providerRef: "SIM-CBK-1",
      method: "MPESA",
      amountKes: orderTotal,
      status: "INITIATED",
    },
  });
  return {
    orderRef: order.reference,
    providerRef: payment.providerRef!,
    customerPhone: customer.phone,
  };
}

function darajaSuccess(checkoutRequestId: string, amount: number) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: "TGH2C8WXMD" },
            { Name: "PhoneNumber", Value: 254733000008 },
          ],
        },
      },
    },
  };
}

describe("POST /webhooks/mpesa (Daraja STK result)", () => {
  it("marks payment SUCCESS, credits deposit, flips order to PAID and texts balance", async () => {
    const fx = await seedPendingPayment(5000);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/mpesa",
      payload: darajaSuccess(fx.providerRef, 5000),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ResultCode: 0, ResultDesc: "Accepted" });

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { providerRef: fx.providerRef },
    });
    expect(payment.status).toBe("SUCCESS");
    expect(payment.amountKes).toBe(5000);
    expect((payment.raw as { mpesaReceiptNumber?: string }).mpesaReceiptNumber).toBe(
      "TGH2C8WXMD"
    );

    const order = await prisma.order.findUniqueOrThrow({ where: { reference: fx.orderRef } });
    expect(order.depositPaidKes).toBe(5000);
    expect(order.status).toBe("PAID");

    expect(smsSpy).toHaveBeenCalledTimes(1);
    expect(smsSpy.mock.calls[0][0]).toBe(fx.customerPhone);
    expect(smsSpy.mock.calls[0][1]).toContain("Fully paid");
  });

  it("is idempotent — replaying the same callback never double-credits", async () => {
    const fx = await seedPendingPayment(5000);
    const payload = darajaSuccess(fx.providerRef, 5000);

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: "POST", url: "/webhooks/mpesa", payload });
      expect(res.statusCode).toBe(200);
    }

    const order = await prisma.order.findUniqueOrThrow({ where: { reference: fx.orderRef } });
    expect(order.depositPaidKes).toBe(5000); // credited exactly once
    expect(smsSpy).toHaveBeenCalledTimes(1); // one confirmation SMS
  });

  it("records FAILED for a cancelled STK push without changing deposits", async () => {
    const fx = await seedPendingPayment(5000);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/mpesa",
      payload: {
        Body: {
          stkCallback: {
            CheckoutRequestID: fx.providerRef,
            ResultCode: 1032,
            ResultDesc: "Request cancelled by user",
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { providerRef: fx.providerRef },
    });
    expect(payment.status).toBe("FAILED");

    const order = await prisma.order.findUniqueOrThrow({ where: { reference: fx.orderRef } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.depositPaidKes).toBe(0);
  });

  it("ACKs unknown references with 200 so Daraja doesn't retry", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/mpesa",
      payload: darajaSuccess("UNKNOWN-REF", 100),
    });
    expect(res.statusCode).toBe(200);
    expect(smsSpy).not.toHaveBeenCalled();
  });

  it("ACKs malformed bodies lacking CheckoutRequestID", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/mpesa",
      payload: { Body: {} },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ResultCode).toBe(0);
  });
});

describe("POST /webhooks/payments (legacy AT notifications)", () => {
  it("parses 'KES 100.00' style amounts and finalizes", async () => {
    // AT flow uses its own transactionId as providerRef
    const customer = await prisma.customer.create({ data: { phone: "+254744000009" } });
    const order = await prisma.order.create({
      data: {
        reference: "NY-LEGACY1",
        customerId: customer.id,
        status: "PENDING_PAYMENT",
        channel: "WEB",
        totalKes: 3000,
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        providerRef: "AT-TX-9",
        amountKes: 1000,
        status: "INITIATED",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      payload: { transactionId: "AT-TX-9", status: "Success", value: "KES 1250.50" },
    });

    expect(res.statusCode).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { providerRef: "AT-TX-9" },
    });
    expect(payment.status).toBe("SUCCESS");
    expect(payment.amountKes).toBe(1251); // rounded

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.depositPaidKes).toBe(1251);
    expect(updatedOrder.status).toBe("PAID"); // partial deposit still flips out of PENDING
  });

  it("ignores unknown transaction refs with 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      payload: { transactionId: "NOPE", status: "success" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ignored: "unknown-ref" });
  });

  it("400s when no transaction reference at all", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      payload: { status: "success" },
    });
    expect(res.statusCode).toBe(400);
  });
});
