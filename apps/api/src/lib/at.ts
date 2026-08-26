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
    const body = new URLSearchParams({
      username: config.AT_USERNAME,
      to: recipients,
      message,
    });
    if (config.AT_SENDER_ID) body.set("from", config.AT_SENDER_ID);

    const res = await fetch(`${BASE_URL}/messaging`, {
      method: "POST",
      headers: {
        apiKey: config.AT_API_KEY,
        Accept: "application/json",
      },
      body,
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

