import { describe, expect, it } from "vitest";
import { kes } from "../../src/lib/money.js";

describe("kes", () => {
  it("formats whole amounts with thousands separators", () => {
    expect(kes(12500)).toBe("KES 12,500");
    expect(kes(1234567)).toBe("KES 1,234,567");
  });

  it("rounds fractional amounts", () => {
    expect(kes(1234.6)).toBe("KES 1,235");
    expect(kes(99.4)).toBe("KES 99");
  });

  it("handles zero", () => {
    expect(kes(0)).toBe("KES 0");
  });
});
