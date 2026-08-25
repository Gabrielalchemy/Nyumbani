import type { FastifyInstance } from "fastify";
import { handleUssd } from "./service.js";
import { normalizeKenyanPhone } from "../../lib/phone.js";

export async function ussdRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Africa's Talking USSD callback.
   * AT posts application/x-www-form-urlencoded with:
   *   sessionId, serviceCode, phoneNumber, text
   */
  app.post("/callback", async (req, reply) => {
    const body = req.body as Record<string, string>;
    const { sessionId, serviceCode, text } = body;

    // AT strips the leading "+" — restore E.164 so customers dedupe correctly.
    let phoneNumber = body.phoneNumber;
    try {
      if (phoneNumber) phoneNumber = normalizeKenyanPhone(phoneNumber);
    } catch {
      /* keep raw value; validation happens downstream */
    }

    if (!sessionId || !phoneNumber) {
      return reply.code(400).send("END Invalid request");
    }

    try {
      const response = await handleUssd({
        sessionId,
        phoneNumber,
        text: text ?? "",
      });
      // Must respond as plain text, not JSON
      return reply.type("text/plain").send(response);
    } catch (err) {
      req.log.error(err, "USSD handler failed");
      return reply.type("text/plain").send("END Sorry, something went wrong. Please try again.");
    }
  });
}
