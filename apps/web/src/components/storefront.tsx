import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall, Smartphone, X } from "lucide-react";
import type { Product } from "../lib/types";
import { api, kes } from "../lib/api";
import { usePublicConfig } from "../lib/config";
import { Button, Input, Spinner } from "./ui";
import { EASE } from "./motion";

const GRAIN_PAIRS: [string, string][] = [
  ["#e8b98f", "#a05a2c"],
  ["#d9a06b", "#7c4a1e"],
  ["#caa26e", "#6e4423"],
  ["#e0ac74", "#8a4d24"],
  ["#d49a62", "#5f3a1c"],
  ["#e2b183", "#93531f"],
];

export function grainStyle(i: number): React.CSSProperties {
  const [from, to] = GRAIN_PAIRS[i % GRAIN_PAIRS.length];
  return { "--tw-grain-from": from, "--tw-grain-to": to } as React.CSSProperties;
}

export function ProductImage({
  product,
  index,
  className = "",
}: {
  product: Product;
  index: number;
  className?: string;
}) {
  if (product.imageUrl) {
    return (
      <div className={`relative overflow-hidden bg-sand-100 ${className}`}>
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
      </div>
    );
  }

  return (
    <div className={`woodgrain relative overflow-hidden ${className}`} style={grainStyle(index)}>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-6xl font-semibold text-white/25 select-none">
          {product.name
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </span>
      </span>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}

export function OrderDialog({
  product,
  index,
  onClose,
}: {
  product: Product | null;
  index: number;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [paidStatus, setPaidStatus] = useState<boolean>(false);
  const cfg = usePublicConfig();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  async function submit() {
    if (!product) return;
    setState("loading");
    try {
      const res = await api.post<{
        reference: string;
        message: string;
        checkoutPushed: boolean;
      }>("/api/orders/web", {
        productId: product.id,
        qty,
        phone,
      });
      setOrderRef(res.reference);
      setMessage(res.message);
      setState("done");

      if (res.checkoutPushed && res.reference) {
        let count = 0;
        pollRef.current = setInterval(async () => {
          count++;
          if (count > 20) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            return;
          }
          try {
            const status = await api.get<{ status: string; depositPaidKes: number }>(
              `/api/orders/lookup/${res.reference}`
            );
            if (status.depositPaidKes > 0 || status.status === "PAID") {
              setPaidStatus(true);
              setMessage(
                `Payment confirmed via M-Pesa! Order ${res.reference} is now confirmed and being processed.`
              );
              clearInterval(pollRef.current!);
              pollRef.current = null;
            }
          } catch {
            /* continue polling silently */
          }
        }, 3000);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not place order");
      setState("error");
    }
  }

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 56 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-lift sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-white/85 p-2 text-ink-soft shadow-sm transition hover:bg-sand-100"
            >
              <X size={16} />
            </button>

            <ProductImage product={product} index={index} className="h-52 w-full sm:h-60" />

            <div className="space-y-5 p-6 sm:p-7">
              <div>
                <h3 className="font-display text-2xl font-semibold">{product.name}</h3>
                <p className="mt-1 text-sm text-muted">{product.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-semibold">{kes(product.priceKes)}</span>
                <span className="text-xs font-medium text-muted">
                  {product.stockQty <= product.lowStockThreshold
                    ? `Only ${product.stockQty} left`
                    : `${product.stockQty} in stock`}
                </span>
              </div>

              {state === "done" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800"
                >
                  <strong className="mb-1 block">Order placed!</strong>
                  {message}
                </motion.div>
              ) : (
                <>
                  <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                    <div>
                      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        Qty
                      </span>
                      <div className="flex h-10 items-center rounded-xl border border-sand-200">
                        <button
                          className="h-full w-9 cursor-pointer text-lg text-muted hover:text-ink"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                        <button
                          className="h-full w-9 cursor-pointer text-lg text-muted hover:text-ink disabled:opacity-40"
                          onClick={() => setQty((q) => Math.min(product.stockQty, q + 1))}
                          disabled={qty >= product.stockQty}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        M-Pesa number
                      </span>
                      <Input
                        placeholder="07XX XXX XXX"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </label>
                  </div>

                  {state === "error" && (
                    <p className="text-sm text-red-600">{message}</p>
                  )}

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={submit}
                    disabled={state === "loading" || phone.length < 9}
                  >
                    {state === "loading" ? (
                      <Spinner className="border-white/40 border-t-white" />
                    ) : (
                      <>
                        <Smartphone size={17} /> Pay deposit · {kes(product.priceKes * qty)}
                      </>
                    )}
                  </Button>

                  <div className="flex items-start gap-3 rounded-2xl bg-sand-100 p-4 text-xs leading-relaxed text-ink-soft">
                    <PhoneCall size={15} className="mt-0.5 shrink-0 text-clay-700" />
                    <span>
                      Prefer your keypad? Dial{" "}
                      <strong className="tracking-wider">{cfg.ussdServiceCode}</strong> on any phone
                      to order without internet.
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

