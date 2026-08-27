import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAdmin } from "../auth/routes.js";
import { config } from "../../config.js";

const UPLOAD_DIR = resolve(process.cwd(), "uploads");
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const invoiceSchema = z.object({
  supplier: z.string().describe("Business/supplier name on the document"),
  documentDate: z.string().describe("Document date as YYYY-MM-DD"),
  currency: z.string().default("KES"),
  category: z
    .enum(["raw_materials", "tools", "transport", "rent", "utilities", "other"])
    .describe("Best-guess spend category"),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitAmount: z.number(),
    })
  ),
  totalAmount: z.number().describe("Grand total payable"),
  notes: z.string().optional(),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;

export async function adminInsightRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /** Upload an invoice/receipt; Gemini extracts structured data immediately. */
  app.post("/documents", async (req, reply) => {
    const file = await req.file({ limits: { fileSize: MAX_FILE_BYTES } });
    if (!file) return reply.code(400).send({ error: "No file uploaded" });
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return reply.code(400).send({ error: `Unsupported file type: ${file.mimetype}` });
    }

    const buf = await file.toBuffer();
    await mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = `${Date.now()}-${randomBytes(4).toString("hex")}-${file.filename.replace(/[^\w.-]/g, "_")}`;
    await writeFile(resolve(UPLOAD_DIR, storedName), buf);

    const doc = await prisma.document.create({
      data: {
        filename: file.filename,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: buf.byteLength,
        kind: "invoice",
        status: "PENDING",
      },
    });

    if (!config.GEMINI_API_KEY) {
      return reply.code(201).send({
        ...doc,
        warning:
          "GEMINI_API_KEY not set — document saved but not yet analyzed.",
      });
    }

    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: invoiceSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file" as const,
                data: new Uint8Array(buf),
                mediaType: file.mimetype,
              },
              {
                type: "text" as const,
                text: "This is a business document (invoice/receipt) from a small manufacturer. Extract the structured data. Amounts are in Kenyan Shillings unless stated otherwise.",
              },
            ],
          },
        ],
      });

      const processed = await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "PROCESSED",
          extracted: object as object,
          error: null,
        },
      });
      return reply.code(201).send(processed);
    } catch (err) {
      req.log.error(err, "Gemini extraction failed");
      const failed = await prisma.document.update({
        where: { id: doc.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : "extraction failed" },
      });
      return reply.code(201).send(failed);
    }
  });

  app.get("/documents", async () =>
    prisma.document.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  );

  /** Download the original uploaded file (owner-only). */
  app.get<{ Params: { id: string } }>("/documents/:id/file", async (req, reply) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc?.storedName) return reply.code(404).send({ error: "File not found" });

    const path = resolve(UPLOAD_DIR, doc.storedName);
    if (!path.startsWith(UPLOAD_DIR + "/")) {
      return reply.code(400).send({ error: "Invalid document reference" });
    }
    return reply
      .header("Content-Type", doc.mimeType)
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`
      )
      .send(createReadStream(path));
  });
}
