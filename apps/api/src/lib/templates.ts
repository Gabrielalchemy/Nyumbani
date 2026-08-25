import { config } from "../config.js";
import { kes } from "./money.js";

/**
 * All customer/owner-facing copy lives here so wording stays consistent
 * across SMS, USSD, dashboard and reports.
 */

export const sms = {
  otp: (code: string) =>
    `${code} is your ${config.BUSINESS_NAME} dashboard login code. Valid for 5 minutes.`,

  orderPlacedCustomer: (ref: string, total: number, depositPrompted: boolean) =>
    depositPrompted
      ? [
          `Asante! Order ${ref} received.`,
          `Total: ${kes(total)}.`,
          `We've sent an M-Pesa prompt to complete your deposit.`,
          `You'll get updates as we work on it. - ${config.BUSINESS_NAME}`,
        ].join(" ")
      : [
          `Asante! Order ${ref} received.`,
          `Total: ${kes(total)}.`,
          `We'll contact you shortly about payment and delivery. - ${config.BUSINESS_NAME}`,
        ].join(" "),

  paymentReceived: (ref: string, amount: number, balance: number) =>
    balance > 0
      ? `Payment of ${kes(amount)} received for ${ref}. Balance: ${kes(balance)}. Asante! - ${config.BUSINESS_NAME}`
      : `Payment of ${kes(amount)} received for ${ref}. Fully paid. Asante! - ${config.BUSINESS_NAME}`,

  newOrderOwner: (ref: string, summary: string, customerPhone: string, total: number) =>
    `New order ${ref}: ${summary}. Customer: ${customerPhone}. Total: ${kes(total)}.`,

  lowStockOwner: (productName: string, remaining: number, threshold: number) =>
    `Stock alert: ${productName} has only ${remaining} left (alert level ${threshold}). Time to restock. - ${config.BUSINESS_NAME}`,

  statusUpdateCustomer: (ref: string, statusLabel: string, nextLine?: string) =>
    [`Update on order ${ref}: ${statusLabel}.`, nextLine, `- ${config.BUSINESS_NAME}`]
      .filter(Boolean)
      .join(" "),
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment confirmed",
  IN_PRODUCTION: "In production",
  READY: "Ready for pickup/delivery",
  DELIVERED: "Delivered. Asante!",
  CANCELLED: "Cancelled",
};
