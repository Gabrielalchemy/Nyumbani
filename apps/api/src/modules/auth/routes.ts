import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../lib/db.js";
import { config } from "../../config.js";
import { normalizeKenyanPhone } from "../../lib/phone.js";
import { sendSms } from "../../lib/at.js";
import { sms } from "../../lib/templates.js";

const OTP_TTL_MS = 5 * 60 * 1000;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** Request a login code — always sent to the owner's phone (single-admin system). */
  app.post("/auth/request-otp", async (req, reply) => {
    const body = (req.body ?? {}) as { phone?: string };

    if (body.phone) {
      let normalized: string;
      try {
        normalized = normalizeKenyanPhone(body.phone);
      } catch {
        return reply.code(400).send({ error: "Invalid phone number" });
      }
      if (normalized !== config.OWNER_PHONE) {
        // Don't reveal whether the account exists
        return reply.code(200).send({ ok: true });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.otpCode.create({
      data: {
        phone: config.OWNER_PHONE,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const result = await sendSms(config.OWNER_PHONE, sms.otp(code));
    // DX: when SMS is simulated (no AT creds) and we're in dev,
    // surface the code so the dashboard is still testable.
    return reply.send({
      ok: true,
      simulated: result.simulated,
      ...(result.simulated && config.NODE_ENV === "development" ? { devCode: code } : {}),
    });
  });

  app.post<{ Body: { code: string; phone?: string } }>("/auth/verify-otp", async (req, reply) => {
    const provided = (req.body?.code ?? "").trim();
    let phone = config.OWNER_PHONE;
    if (req.body?.phone) {
      try {
        phone = normalizeKenyanPhone(req.body.phone);
      } catch {
        return reply.code(400).send({ error: "Invalid phone" });
      }
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        code: provided,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return reply.code(401).send({ error: "Invalid or expired code" });
    }
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const token = app.jwt.sign(
      { role: "admin", phone },
      { expiresIn: "12h" }
    );
    return reply.send({ ok: true, token });
  });
}

/** Guard for /admin/* routes */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
