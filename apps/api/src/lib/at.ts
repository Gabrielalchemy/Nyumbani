import { config } from "../config.js";

const BASE_URL =
  config.AT_ENVIRONMENT === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1"
    : "https://api.africastalking.com/version1";

export interface AtResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  simulated: boolean;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apiKey: config.AT_API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
}

/** True when we have credentials — otherwise calls are logged & simulated. */
export function atConfigured(): boolean {
  return config.AT_API_KEY.length > 0 && config.AT_USERNAME.length > 0;
}

// ── SMS ────────────────────────────────────────────────────────────────

interface SmsResponse {
  SMSMessageData?: { Recipients?: unknown[] };
}

export async function sendSms(to: string | string[], message: string): Promise<AtResult<SmsResponse>> {
  const recipients = (Array.isArray(to) ? to : [to]).join(",");
  if (!atConfigured()) {
    console.log(`[AT:simulated SMS] → ${recipients}\n${message}\n`);
    return { ok: true, simulated: true };
  }
  try {
    const body: Record<string, unknown> = {
      username: config.AT_USERNAME,
      to: recipients,
      message,
    };
    if (config.AT_SENDER_ID) body.from = config.AT_SENDER_ID;

    const res = await fetch(`${BASE_URL}/messaging`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as SmsResponse;
    if (!res.ok) {
      console.error("[AT SMS error]", res.status, data);
      return { ok: false, error: `SMS failed (${res.status})`, simulated: false };
    }
    return { ok: true, data, simulated: false };
  } catch (err) {
    console.error("[AT SMS exception]", err);
    return { ok: false, error: "SMS network error", simulated: false };
  }
}

// ── Mobile Money Checkout (M-Pesa STK-style push) ─────────────────────

interface CheckoutResponse {
  status?: string;
  transactionId?: string;
  description?: string;
}

export async function mobileCheckout(params: {
  phoneNumber: string;
  amountKes: number;
  productName?: string;
  metadata?: Record<string, string>;
}): Promise<AtResult<CheckoutResponse>> {
  if (!atConfigured()) {
    const fakeRef = `SIM-${Date.now().toString(36).toUpperCase()}`;
    console.log(
      `[AT:simulated checkout] ${params.phoneNumber} ${params.amountKes} KES → ref ${fakeRef}`
    );
    return { ok: true, data: { status: "Success", transactionId: fakeRef }, simulated: true };
  }
  try {
    const res = await fetch(`${BASE_URL}/mobile/checkout`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        username: config.AT_USERNAME,
        productName: params.productName ?? config.AT_CHECKOUT_PRODUCT,
        phoneNumber: params.phoneNumber,
        currencyCode: "KES",
        amount: params.amountKes,
        metadata: params.metadata ?? {},
      }),
    });
    const data = (await res.json()) as CheckoutResponse;
    if (!res.ok || (data.status && data.status !== "Success")) {
      console.error("[AT checkout error]", res.status, data);
      return { ok: false, error: data.description ?? "Checkout failed", simulated: false };
    }
    return { ok: true, data, simulated: false };
  } catch (err) {
    console.error("[AT checkout exception]", err);
    return { ok: false, error: "Checkout network error", simulated: false };
  }
}
