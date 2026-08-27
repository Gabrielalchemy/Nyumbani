/**
 * Normalize Kenyan phone numbers to E.164 (+2547XXXXXXXX).
 * Accepts: 07.., 01.., 2547.., +2547..
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let e164: string;

  if (digits.startsWith("0") && digits.length === 10) {
    e164 = `254${digits.slice(1)}`;
  } else if (digits.startsWith("254") && digits.length === 12) {
    e164 = digits;
  } else if (digits.length === 9 && /^[17]/.test(digits)) {
    e164 = `254${digits}`;
  } else {
    throw new Error(`Invalid Kenyan phone number: ${raw}`);
  }

  if (!/^254[17]\d{8}$/.test(e164)) {
    throw new Error(`Invalid Kenyan phone number: ${raw}`);
  }
  return `+${e164}`;
}
