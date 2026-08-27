import { describe, expect, it } from "vitest";
import { sms, STATUS_LABELS } from "../../src/lib/templates.js";
import { config } from "../../src/config.js";
import { kes } from "../../src/lib/money.js";

describe("sms templates", () => {
  it("otp includes the code and validity window", () => {
    const text = sms.otp("123456");
    expect(text).toContain("123456");
    expect(text).toContain("5 minutes");
    expect(text).toContain(config.BUSINESS_NAME);
  });

  it("order placed customer copy varies by deposit prompt", () => {
    const withDeposit = sms.orderPlacedCustomer("NY-ABC123", 2500, true);
    expect(withDeposit).toContain("NY-ABC123");
    expect(withDeposit).toContain(kes(2500));
    expect(withDeposit).toContain("M-Pesa prompt");

    const arranged = sms.orderPlacedCustomer("NY-ABC123", 2500, false);
    expect(arranged).toContain("We'll contact you shortly");
    expect(arranged).not.toContain("M-Pesa");
  });

  it("payment received shows balance or full-paid wording", () => {
    const partial = sms.paymentReceived("NY-X1", 1000, 1500);
    expect(partial).toContain("Balance: KES 1,500");

    const settled = sms.paymentReceived("NY-X1", 2000, 0);
    expect(settled).toContain("Fully paid");
    expect(settled).not.toContain("Balance:");
  });

  it("low stock alert names product, remaining and threshold", () => {
    const text = sms.lowStockOwner("Ash tray", 2, 3);
    expect(text).toContain("Ash tray");
    expect(text).toContain("2 left");
    expect(text).toContain("3");
  });

  it("status update carries the label and brand signature", () => {
    const text = sms.statusUpdateCustomer("NY-Z9", STATUS_LABELS.DELIVERED);
    expect(text).toContain("Delivered");
    expect(text).toContain(`- ${config.BUSINESS_NAME}`);
  });
});

describe("STATUS_LABELS", () => {
  it("covers every order status", () => {
    for (const s of [
      "PENDING_PAYMENT",
      "PAID",
      "IN_PRODUCTION",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ]) {
      expect(typeof STATUS_LABELS[s]).toBe("string");
    }
  });
});
