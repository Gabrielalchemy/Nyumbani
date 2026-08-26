import { config } from "../config.js";

/**
 * Safaricom Daraja — M-Pesa Express (STK push / Lipa na M-Pesa Online).
 * Replaces the retired Africa's Talking Mobile Checkout.
 *
 * Without DARAJA_CONSUMER_KEY/SECRET the client simulates deterministically so the
 * whole order → payment → webhook flow stays testable offline.
 */

const BASE_URL =
  config.DARAJA_ENV === "sandbox"
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";

/** Public sandbox passkey for shortcode 174379 (documented by Safaricom). */
const SANDBOX_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

export interface StkPushResult {
  ok: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  customerMessage?: string;
  error?: string;
  simulated: boolean;
}

export function mpesaConfigured(): boolean {
  return config.DARAJA_CONSUMER_KEY.length > 0 && config.DARAJA_CONSUMER_SECRET.length > 0;
}

// ── OAuth token (cached until ~60s before expiry) ─────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const basic = Buffer.from(
    `${config.DARAJA_CONSUMER_KEY}:${config.DARAJA_CONSUMER_SECRET}`
  ).toString("base64");
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string; expires_in?: string };
  if (!data.access_token) throw new Error("Daraja auth returned no token");

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3599) * 1000 - 60_000,
  };
  return tokenCache.token;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** +2547XXXXXXXX → 2547XXXXXXXX (Daraja wants MSISDN without the plus). */
function msisdn(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Timestamp in Nairobi time, format yyyyMMddHHmmss. */
function timestamp(): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  // Daraja expects EAT; Intl may yield "24" for hour — map to 00.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}${p.month}${p.day}${hour}${p.minute}${p.second}`;
}

function pushPassword(ts: string): string {
  const passkey = config.DARAJA_ENV === "sandbox" && !config.DARAJA_PASSKEY ? SANDBOX_PASSKEY : config.DARAJA_PASSKEY;
  return Buffer.from(`${config.DARAJA_SHORTCODE}${passkey}${ts}`).toString("base64");
}

// ── STK push ───────────────────────────────────────────────────────────

export async function stkPush(params: {
  phoneNumber: string;
  amountKes: number;
  /** Shown on the customer's statement/prompt — keep ≤ 12 chars (e.g. order ref). */
  accountReference: string;
  description: string;
  /** Public URL that receives the result, e.g. {PUBLIC_BASE_URL}/webhooks/mpesa */
  callbackUrl: string;
}): Promise<StkPushResult> {
  if (!mpesaConfigured()) {
    const fake = `SIM-${Date.now().toString(36).toUpperCase()}`;
    console.log(
      `[M-Pesa:simulated STK] ${params.phoneNumber} ${params.amountKes} KES → checkoutRequestId ${fake}`
    );
    return {
      ok: true,
      merchantRequestId: fake,
      checkoutRequestId: `ws_CO_${fake}`,
      customerMessage: "Success. Request accepted for processing",
      simulated: true,
    };
  }

  try {
    const token = await accessToken();
    const ts = timestamp();
    const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.DARAJA_SHORTCODE,
        Password: pushPassword(ts),
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(params.amountKes),
        PartyA: msisdn(params.phoneNumber),
        PartyB: config.DARAJA_SHORTCODE,
        PhoneNumber: msisdn(params.phoneNumber),
        CallBackURL: params.callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: params.description.slice(0, 13),
      }),
    });
    const data = (await res.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      errorMessage?: string;
    };

    if (!res.ok || data.ResponseCode !== "0") {
      console.error("[M-Pesa STK error]", res.status, data);
      return {
        ok: false,
        error: data.errorMessage ?? data.ResponseDescription ?? `STK push failed (${res.status})`,
        simulated: false,
      };
    }
    return {
      ok: true,
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage,
      simulated: false,
    };
  } catch (err) {
    console.error("[M-Pesa STK exception]", err);
    return { ok: false, error: "M-Pesa network error", simulated: false };
  }
}
