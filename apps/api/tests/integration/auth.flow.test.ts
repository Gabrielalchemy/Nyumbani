import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/at.js", () => ({
  sendSms: vi.fn(async () => ({ ok: true, simulated: true })),
}));

import { config } from "../../src/config.js";
import { disconnectDb, prisma, resetDb } from "../helpers/db.js";
import { buildApp } from "../helpers/app.js";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
});

beforeEach(async () => {
  await resetDb();
});

describe("POST /api/auth/request-otp", () => {
  it("returns a devCode when SMS is simulated in development", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-otp",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.simulated).toBe(true);
    expect(String(body.devCode)).toMatch(/^\d{6}$/);

    const otp = await prisma.otpCode.findFirstOrThrow({
      where: { code: body.devCode },
    });
    expect(otp.phone).toBe(config.OWNER_PHONE);
    expect(otp.consumedAt).toBeNull();
  });

  it("silently accepts non-owner phone numbers without creating codes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-otp",
      payload: { phone: "+254711111111" },
    });
    // no enumeration leak
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.json().devCode).toBeUndefined();
    expect(await prisma.otpCode.count()).toBe(0);
  });

  it("400s on malformed phones", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-otp",
      payload: { phone: "not-a-phone" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/verify-otp", () => {
  async function requestDevCode(): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-otp",
      payload: {},
    });
    return res.json().devCode;
  }

  it("issues a JWT for the correct code and consumes it (single use)", async () => {
    const devCode = await requestDevCode();

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/verify-otp",
      payload: { code: devCode },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().token).toBeTruthy();

    const consumed = await prisma.otpCode.findFirstOrThrow({
      where: { code: devCode },
    });
    expect(consumed.consumedAt).not.toBeNull();

    // replay of the same code fails
    const replay = await app.inject({
      method: "POST",
      url: "/api/auth/verify-otp",
      payload: { code: devCode },
    });
    expect(replay.statusCode).toBe(401);
  });

  it("rejects wrong codes", async () => {
    await requestDevCode();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-otp",
      payload: { code: "000000" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects expired codes", async () => {
    await prisma.otpCode.create({
      data: {
        phone: config.OWNER_PHONE,
        code: "424242",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify-otp",
      payload: { code: "424242" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("requireAdmin guard end-to-end", () => {
  let token = "";

  beforeAll(async () => {
    const otpRes = await app.inject({
      method: "POST",
      url: "/api/auth/request-otp",
      payload: {},
    });
    token = (
      await app.inject({
        method: "POST",
        url: "/api/auth/verify-otp",
        payload: { code: otpRes.json().devCode },
      })
    ).json().token;
  });

  it("accepts a freshly issued token on admin routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/products",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("rejects tampered tokens", async () => {
    const [head, payload] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ role: "admin", phone: "attacker" })
    ).toString("base64url");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/products",
      headers: { authorization: `Bearer ${head}.${tamperedPayload}.x` },
    });
    expect(res.statusCode).toBe(401);
  });
});
