import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone } from "../../src/lib/phone.js";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0711223344", "+254711223344"],
    ["0112233445", "+254112233445"],
    ["254711223344", "+254711223344"],
    ["+254711223344", "+254711223344"],
    ["711223344", "+254711223344"],
  ])("accepts %s → %s", (raw, expected) => {
    expect(normalizeKenyanPhone(raw)).toBe(expected);
  });

  it("strips spaces, dashes and parentheses before normalizing", () => {
    expect(normalizeKenyanPhone("+254 (711) 223-344")).toBe("+254711223344");
  });

  it.each([
    [""],
    ["07112233445"], // 11 digits starting with 0
    ["07112"], // too short
    ["0202314712"], // landline prefix not allowed
    ["+18005550000"], // non-Kenyan
    ["abcdefghij"],
  ])("rejects %s", (raw) => {
    expect(() => normalizeKenyanPhone(raw)).toThrow(/Invalid Kenyan phone/);
  });
});
