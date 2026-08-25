import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban } from "lucide-react";
import { api, kes } from "../../lib/api";
import type { Order } from "../../lib/types";
import { Badge, Button, Spinner } from "../../components/ui";

const FLOW = ["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "READY", "DELIVERED"] as const;

const TONE: Record<string, "sand" | "green" | "amber" | "red" | "clay" | "blue"> = {
  PENDING_PAYMENT: "amber",
  PAID: "green",
  IN_PRODUCTION: "blue",
  READY: "clay",
  DELIVERED: "green",
  CANCELLED: "red",
};

export default function OrdersBoard() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get<Order[]>("/api/admin/orders"),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted">
          Advancing a stage automatically texts the customer — no extra work.
        </p>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {FLOW.map((stage) => {
          const items = (orders ?? []).filter((o) => o.status === stage);
          return (
            <section key={stage} className="w-72 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xs font-bold tracking-wider text-ink-soft uppercase">
                  {stage.replace("_", " ")}
                </h2>
                <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((o) => (
                  <OrderCard key={o.id} order={o} onAdvance={advance.mutate} />
                ))}
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed border-sand-300 py-6 text-center text-xs text-muted">
                    Empty
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {/* Cancelled column */}
        <section className="w-72 shrink-0">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold tracking-wider text-ink-soft uppercase">Cancelled</h2>
          </div>
          <div className="space-y-3">
            {(orders ?? [])
              .filter((o) => o.status === "CANCELLED")
              .map((o) => (
                <OrderCard key={o.id} order={o} onAdvance={advance.mutate} />
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: (v: { id: string; status: string }) => void;
}) {
  const idx = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const balance = order.totalKes - order.depositPaidKes;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold">{order.reference}</span>
        <Badge tone={TONE[order.status] ?? "sand"}>{order.channel}</Badge>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
        {order.items.map((i) => (
          <li key={i.id}>
            {i.qty}× {i.product?.name}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-xs text-muted">{order.customer?.phone}</p>
      <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3">
        <div className="text-xs">
          <span className="font-semibold">{kes(order.totalKes)}</span>
          {balance > 0 && order.status !== "CANCELLED" && (
            <span className="ml-1.5 text-amber-700">· bal {kes(balance)}</span>
          )}
        </div>
        {order.status === "CANCELLED" ? (
          <Badge tone="red">cancelled</Badge>
        ) : next ? (
          <Button size="sm" variant="secondary" onClick={() => onAdvance({ id: order.id, status: next })}>
            → {next.replace("_", " ").toLowerCase()} <ArrowRight size={12} />
          </Button>
        ) : null}
        {!["DELIVERED", "CANCELLED"].includes(order.status) && (
          <button
            aria-label={`Cancel ${order.reference}`}
            title="Cancel order (returns stock)"
            onClick={() => onAdvance({ id: order.id, status: "CANCELLED" })}
            className="cursor-pointer rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
          >
            <Ban size={14} />
          </button>
        )}
      </div>
    </article>
  );
}
