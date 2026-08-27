import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAdmin } from "../auth/routes.js";
import { checkLowStockAlerts } from "../orders/service.js";

const productInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  priceKes: z.number().int().positive(),
  stockQty: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(3),
  imageUrl: z.string().url().optional().nullable(),
  visible: z.boolean().default(true),
});

export async function publicProductRoutes(app: FastifyInstance): Promise<void> {
  app.get("/products", async () => {
    return prisma.product.findMany({
      where: { visible: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        priceKes: true,
        stockQty: true,
        lowStockThreshold: true,
        imageUrl: true,
      },
    });
  });
}

export async function adminProductRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.get("/products", async () => prisma.product.findMany({ orderBy: { createdAt: "desc" } }));

  app.post<{ Body: unknown }>("/products", async (req, reply) => {
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const p = await prisma.product.create({
      data: {
        ...parsed.data,
        stockMovements:
          parsed.data.stockQty > 0
            ? {
                create: {
                  delta: parsed.data.stockQty,
                  reason: "INITIAL",
                },
              }
            : undefined,
      },
    });
    return reply.code(201).send(p);
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/products/:id", async (req, reply) => {
    const parsed = productInput.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    return prisma.product.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
  });

  app.delete<{ Params: { id: string } }>("/products/:id", async (req) => {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { visible: false },
    });
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { qty?: number; note?: string } }>(
    "/products/:id/restock",
    async (req, reply) => {
      const qty = Number(req.body?.qty ?? 0);
      if (!Number.isInteger(qty) || qty <= 0) {
        return reply.code(400).send({ error: "qty must be a positive integer" });
      }
      const prev = await prisma.product.findUniqueOrThrow({ where: { id: req.params.id } });
      const [updated] = await prisma.$transaction([
        prisma.product.update({
          where: { id: req.params.id },
          data: { stockQty: { increment: qty } },
        }),
        prisma.stockMovement.create({
          data: {
            productId: req.params.id,
            delta: qty,
            reason: "RESTOCK",
            note: req.body?.note ?? `Restocked +${qty}`,
          },
        }),
      ]);
      void checkLowStockAlerts([{ productId: req.params.id, prevQty: prev.stockQty }]).catch(() => {});
      return updated;
    }
  );
}
