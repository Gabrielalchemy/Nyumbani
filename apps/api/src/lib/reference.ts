import { randomBytes } from "node:crypto";

/** Human-friendly order reference, e.g. NY-7QK3ZM */
export function newOrderReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `NY-${out}`;
}
