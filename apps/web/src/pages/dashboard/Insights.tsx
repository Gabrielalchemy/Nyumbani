import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FileText,
  MessageSquareText,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { api, kes } from "../../lib/api";
import type { DocumentRow, ReportRow } from "../../lib/types";
import { Badge, Button, Spinner } from "../../components/ui";

export default function Insights() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<DocumentRow[]>("/api/admin/documents"),
  });
  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportRow[]>("/api/admin/reports"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload("/api/admin/documents", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const generateReport = useMutation({
    mutationFn: () => api.post("/api/admin/reports/generate"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const sendSms = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/reports/${id}/send-sms`),
  });

  const latest = reports?.[0];
  const m = latest?.metrics;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Sparkles size={20} className="text-clay-600" /> AI insights
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload invoices and receipts — Gemini turns them into a clear business report.
        </p>
      </header>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) upload.mutate(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragOver ? "border-clay-500 bg-clay-100/60" : "border-sand-300 bg-white hover:bg-sand-50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
        />
        {upload.isPending ? (
          <Spinner className="mx-auto" />
        ) : (
          <>
            <UploadCloud className="mx-auto text-clay-600" size={28} />
            <p className="mt-3 text-sm font-medium">
              Drop an invoice or receipt here{" "}
              <span className="text-muted">— PDF or photo</span>
            </p>
            <p className="mt-1 text-xs text-muted">Gemini reads it instantly. Max 10 MB.</p>
          </>
        )}
      </div>

      {/* Documents */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Processed documents{" "}
          <span className="text-sm font-normal text-muted">({docs?.length ?? 0})</span>
        </h2>
        {(docs ?? []).length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted shadow-card">
            Nothing uploaded yet.
          </p>
        )}
        {(docs ?? []).map((d) => (
          <motion.article layout key={d.id} className="rounded-2xl bg-white shadow-card">
            <button
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={18} className="shrink-0 text-clay-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.filename}</p>
                  <p className="text-xs text-muted">
                    {d.extracted
                      ? `${d.extracted.supplier} · ${kes(d.extracted.totalAmount)}`
                      : d.status.toLowerCase()}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  tone={
                    d.status === "PROCESSED" ? "green" : d.status === "FAILED" ? "red" : "sand"
                  }
                >
                  {d.status.toLowerCase()}
                </Badge>
                <ChevronDown
                  size={16}
                  className={`text-muted transition-transform ${expanded === d.id ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            <AnimatePresence>
              {expanded === d.id && d.extracted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-sand-100"
                >
                  <div className="space-y-2 p-4 text-xs text-ink-soft">
                    <p>
                      <strong>Category:</strong> {d.extracted.category} ·{" "}
                      <strong>Date:</strong> {d.extracted.documentDate}
                    </p>
                    <ul className="divide-y divide-sand-100">
                      {d.extracted.lineItems.map((li, i) => (
                        <li key={i} className="flex justify-between py-1.5">
                          <span>
                            {li.quantity}× {li.description}
                          </span>
                          <span>{kes(li.unitAmount * li.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-1 text-right font-semibold">{kes(d.extracted.totalAmount)} total</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        ))}
      </section>

      {/* Report */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Business report</h2>
          <Button onClick={() => generateReport.mutate()} disabled={generateReport.isPending}>
            {generateReport.isPending ? (
              <Spinner className="border-white/40 border-t-white" />
            ) : (
              <Sparkles size={15} />
            )}
            Generate report
          </Button>
        </div>

        {latest && m ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                ["Revenue booked", kes(m.revenueBookedKes)],
                ["Cash collected", kes(m.cashCollectedKes)],
                ["Expenses on file", kes(m.expenses?.totalKes ?? 0)],
                ["Inventory value", kes(m.stock?.inventoryValueKes ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-5 shadow-card">
                  <p className="font-display text-lg font-semibold sm:text-xl">{value}</p>
                  <p className="mt-0.5 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>

            <article className="rounded-2xl bg-gradient-to-br from-ink to-[#3a2620] p-6 text-paper shadow-lift sm:p-7">
              <p className="text-xs font-bold tracking-[0.16em] text-clay-300 uppercase">
                {latest.periodLabel}
              </p>
              <p className="mt-3 leading-relaxed whitespace-pre-line">{latest.narrative}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-5"
                onClick={() => sendSms.mutate(latest.id)}
                disabled={sendSms.isPending}
              >
                <MessageSquareText size={14} /> Text me a summary
              </Button>
            </article>
          </>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted shadow-card">
            No reports yet — upload a few documents then hit “Generate report”.
          </p>
        )}
      </section>
    </div>
  );
}
