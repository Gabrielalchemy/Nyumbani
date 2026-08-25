import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, PackageCheck, Wallet, ClipboardList, AlertTriangle } from "lucide-react";
import { api, kes } from "../../lib/api";
import type { Order, Product, ReportRow } from "../../lib/types";
import { Badge } from "../../components/ui";

const STATUS_TONE: Record<string, "sand" | "green" | "amber" | "red" | "clay" | "blue"> = {
  PENDING_PAYMENT: "amber",
  PAID: "green",
  IN_PRODUCTION: "blue",
  READY: "clay",
  DELIVERED: "green",
  CANCELLED: "red",
};

export default function Overview() {
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/api/admin/orders"),
  });
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api.get<Product[]>("/api/admin/products"),
  });
  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportRow[]>("/api/admin/reports"),
  });

  const list = orders ?? [];
  const revenue = list.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.totalKes, 0);
  const collected = list.reduce((s, o) => s + o.depositPaidKes, 0);
  const lowStock = (products ?? []).filter((p) => p.stockQty <= p.lowStockThreshold);
  const latestReport = reports?.[0];

  const stats = [
    { label: "Revenue booked", value: kes(revenue), icon: Wallet },
    { label: "Deposits collected", value: kes(collected), icon: PackageCheck },
    {
      label: "Open orders",
      value: String(list.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length),
      icon: ClipboardList,
    },
    { label: "Low stock items", value: String(lowStock.length), icon: AlertTriangle },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Habari ya leo 👋
        </h1>
        <p className="mt-1 text-sm text-muted">Here's what's happening in your workshop.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-5 shadow-card">
            <Icon size={18} className="text-clay-600" />
            <p className="mt-3 font-display text-xl font-semibold sm:text-2xl">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent orders */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent orders</h2>
            <Link
              to="/dashboard/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-clay-700 hover:underline"
            >
              All orders <ArrowRight size={13} />
            </Link>
          </div>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No orders yet — share your USSD code to get the first one.
            </p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {list.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {o.reference}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {o.items.map((i) => `${i.qty}× ${i.product?.name ?? ""}`).join(", ")}
                      </span>
                    </p>
                    <p className="text-xs text-muted">{o.customer?.phone}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm font-semibold">{kes(o.totalKes)}</span>
                    <Badge tone={STATUS_TONE[o.status] ?? "sand"}>
                      {o.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Stock + latest AI report */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold">Needs restocking</h2>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted">All stock healthy 🎉</p>
            ) : (
              <ul className="space-y-2.5">
                {lowStock.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <Badge tone={p.stockQty === 0 ? "red" : "amber"}>{p.stockQty} left</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {latestReport && (
            <section className="rounded-2xl bg-clay-100 p-6">
              <h2 className="font-display text-base font-semibold text-clay-800">
                Latest AI insight
              </h2>
              <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-clay-900/80">
                {latestReport.narrative}
              </p>
              <Link
                to="/dashboard/insights"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-clay-800 hover:underline"
              >
                Open insights <ArrowRight size={12} />
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
