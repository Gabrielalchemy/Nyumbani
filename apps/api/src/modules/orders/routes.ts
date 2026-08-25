import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAdmin } from "../auth/routes.js";
import { sendSms } from "../../lib/at.js";
import { sms, STATUS_LABELS } from "../../lib/templates.js";

const statusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "IN_PRODUCTION",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

export async function adminOrderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/orders", async () => {
    return prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { phone: true, name: true } },
        items: { include: { product: { select: { name: true, id: true } } } },
      },
    });
  });

  /**
   * Status transitions notify the customer over SMS automatically —
   * the dashboard is just a thin control surface.
   */
  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    "/orders/:id/status",
    async (req, reply) => {
      const parsed = statusSchema.safeParse(req.body?.status);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid status" });
      const status = parsed.data;

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { customer: true },
      });

      if (status === "CANCELLED" && order.status !== "CANCELLED") {
        // Return reserved stock
        await prisma.$transaction(async (tx) => {
          for (const item of await tx.orderItem.findMany({ where: { orderId: order.id } })) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: item.qty } },
            });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                delta: item.qty,
                reason: "RESTOCK",
                note: `Cancelled order ${order.reference}`,
              },
            });
          }
          await tx.order.update({ where: { id: order.id }, data: { status } });
        });
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: { status },
        });
      }

      if (order.status !== status) {
        await sendSms(
          order.customer.phone,
          sms.statusUpdateCustomer(order.reference, STATUS_LABELS[status])
        );
      }
      return { ok: true };
    }
  );
}
