import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { EASE } from "./motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-clay-700 focus-visible:outline-clay-600 shadow-[0_6px_16px_-8px_rgb(28_25_23_/_0.5)]",
  secondary: "bg-clay-100 text-clay-800 hover:bg-clay-200 focus-visible:outline-clay-600",
  ghost: "bg-transparent text-ink hover:bg-sand-100",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center rounded-full font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-xl border border-sand-200 bg-white px-3.5 text-sm text-ink placeholder:text-muted/70 focus:border-clay-400 focus:ring-2 focus:ring-clay-200 focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Badge({
  tone = "sand",
  children,
}: {
  tone?: "sand" | "green" | "amber" | "red" | "clay" | "blue";
  children: ReactNode;
}) {
  const tones = {
    sand: "bg-sand-100 text-ink-soft",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    clay: "bg-clay-100 text-clay-800",
    blue: "bg-sky-50 text-sky-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift sm:rounded-3xl ${
              wide ? "sm:max-w-2xl" : "sm:max-w-md"
            }`}
          >
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-white/80 p-1.5 text-ink-soft backdrop-blur transition hover:bg-sand-100"
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-sand-300 border-t-clay-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
