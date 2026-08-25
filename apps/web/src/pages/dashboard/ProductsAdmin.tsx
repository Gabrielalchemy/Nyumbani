import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { PackageOpen, Plus } from "lucide-react";
import { api, kes } from "../../lib/api";
import type { Product } from "../../lib/types";
import { Badge, Button, Field, Input, Modal, Spinner } from "../../components/ui";

const EMPTY = {
  name: "",
  description: "",
  category: "",
  priceKes: 0,
  stockQty: 0,
  lowStockThreshold: 3,
};

export default function ProductsAdmin() {
  const qc = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api.get<Product[]>("/api/admin/products"),
  });

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [restockQty, setRestockQty] = useState<Record<string, number>>({});

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        priceKes: Number(form.priceKes),
        stockQty: Number(form.stockQty),
        lowStockThreshold: Number(form.lowStockThreshold),
        description: form.description || null,
        category: form.category || null,
      };
      if (editing) return api.patch(`/api/admin/products/${editing.id}`, payload);
      return api.post("/api/admin/products", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      close();
    },
  });

  const restock = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.post(`/api/admin/products/${id}/restock`, { qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setRestockQty({});
    },
  });

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "",
      priceKes: p.priceKes,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold,
    });
  }
  function close() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY);
  }

  const dialogOpen = creating || editing !== null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Products & stock</h1>
          <p className="mt-1 text-sm text-muted">
            Everything here is instantly live on USSD and the website.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setForm(EMPTY);
          }}
        >
          <Plus size={16} /> New product
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {(products ?? []).map((p) => {
              const low = p.stockQty <= p.lowStockThreshold;
              return (
                <motion.article
                  key={p.id}
                  layout
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="rounded-2xl bg-white p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="cursor-pointer text-left font-display text-base font-semibold hover:text-clay-700"
                    >
                      {p.name}
                    </button>
                    {!p.visible ? (
                      <Badge tone="sand">hidden</Badge>
                    ) : low ? (
                      <Badge tone={p.stockQty === 0 ? "red" : "amber"}>
                        {p.stockQty === 0 ? "sold out" : `${p.stockQty} left`}
                      </Badge>
                    ) : (
                      <Badge tone="green">{p.stockQty} in stock</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
                    {p.description ?? "No description"}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-sand-100 pt-4">
                    <span className="font-display font-semibold">{kes(p.priceKes)}</span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        className="h-8 w-16 rounded-lg px-2 text-xs"
                        placeholder="+qty"
                        inputMode="numeric"
                        value={restockQty[p.id] ?? ""}
                        onChange={(e) =>
                          setRestockQty((m) => ({
                            ...m,
                            [p.id]: Number(e.target.value.replace(/\D/g, "")) || 0,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant={low ? "primary" : "secondary"}
                        disabled={!restockQty[p.id]}
                        onClick={() =>
                          restock.mutate({ id: p.id, qty: Number(restockQty[p.id]) })
                        }
                      >
                        <PackageOpen size={13} /> Restock
                      </Button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal open={dialogOpen} onClose={close}>
        <form
          className="space-y-4 p-7"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="font-display text-xl font-semibold">
            {editing ? "Edit product" : "New product"}
          </h2>
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (KES)">
              <Input
                required
                inputMode="numeric"
                value={form.priceKes || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priceKes: Number(e.target.value.replace(/\D/g, "")) }))
                }
              />
            </Field>
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </Field>
            <Field label="Stock qty">
              <Input
                inputMode="numeric"
                value={form.stockQty || ""}
                disabled={!!editing}
                title="Use Restock to add inventory"
                onChange={(e) =>
                  setForm((f) => ({ ...f, stockQty: Number(e.target.value.replace(/\D/g, "")) }))
                }
              />
            </Field>
            <Field label="Low-stock alert at">
              <Input
                inputMode="numeric"
                value={form.lowStockThreshold || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    lowStockThreshold: Number(e.target.value.replace(/\D/g, "")),
                  }))
                }
              />
            </Field>
          </div>
          {save.isError && (
            <p className="text-sm text-red-600">
              {save.error instanceof Error ? save.error.message : "Save failed"}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
            {save.isPending ? <Spinner className="border-white/40 border-t-white" /> : editing ? "Save changes" : "Create product"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
