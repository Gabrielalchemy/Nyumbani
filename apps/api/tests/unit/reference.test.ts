import { describe, expect, it } from "vitest";
import { newOrderReference } from "../../src/lib/reference.js";

describe("newOrderReference", () => {
  const ALPHABET = /^[NY ny-]*$/;

  it("has the NY-XXXXXXXX shape", () => {
    for (let i = 0; i < 100; i++) {
      const ref = newOrderReference();
      expect(ref).toMatch(/^NY-[A-Z0-9]{6}$/);
      // no ambiguous characters (I, O, 0, 1)
      expect(ref.slice(3)).not.toMatch(/[IO01]/);
      void ALPHABET;
    }
  });

  it("produces unique references across a large sample", () => {
    const refs = new Set(Array.from({ length: 500 }, () => newOrderReference()));
    expect(refs.size).toBe(500);
  });
});
