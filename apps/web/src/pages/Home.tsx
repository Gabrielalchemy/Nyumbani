import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Hammer, PhoneCall } from "lucide-react";
import { api, kes } from "../lib/api";
import { formatPhone, usePublicConfig } from "../lib/config";
import type { Product } from "../lib/types";
import { Reveal, Stagger, StaggerItem, EASE } from "../components/motion";
import { OrderDialog, ProductImage, TrustStrip, grainStyle } from "../components/storefront";

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled ? "bg-paper/85 shadow-[0_1px_0_0_var(--color-sand-200)] backdrop-blur-md" : ""
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-clay-300">
            <Hammer size={17} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Nyumbani</span>
        </a>
        <div className="hidden items-center gap-7 text-sm font-medium text-ink-soft md:flex">
          <a href="#shop" className="transition hover:text-ink">Shop</a>
          <a href="#how" className="transition hover:text-ink">How to order</a>
          <a href="#craft" className="transition hover:text-ink">Our craft</a>
          <Link to="/dashboard" className="transition hover:text-ink">Owner login</Link>
        </div>
        <a
          href="#shop"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-clay-700"
        >
          Shop now
        </a>
      </nav>
    </motion.header>
  );
}

function Hero() {
  const { scrollY } = useScroll();
  const heroShift = useTransform(scrollY, [0, 500], [0, 80]);
  const heroFade = useTransform(scrollY, [0, 420], [1, 0.25]);

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div
        aria-hidden
        className="absolute -top-24 -right-32 size-[480px] rounded-full bg-sand-100 blur-3xl"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-clay-100 px-3.5 py-1.5 text-xs font-semibold text-clay-800">
            <span className="size-1.5 rounded-full bg-clay-600" />
            Workshop open · Made in Nairobi
          </p>
          <h1 className="font-display text-5xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.2rem]">
            Furniture with a soul,
            <br />
            <span className="text-clay-700 italic">built by hand.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Solid mvule, cypress and teak — cut, joined and finished in our workshop.
            Order in under a minute, pay the deposit with M-Pesa.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#shop"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-medium text-paper shadow-[0_10px_24px_-10px_rgb(28_25_23_/_0.55)] transition hover:bg-clay-700"
            >
              Browse the workshop <ArrowRight size={16} />
            </a>
            <a
              href="#how"
              className="inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium text-ink transition hover:bg-sand-100"
            >
              <PhoneCall size={16} className="text-clay-700" /> How ordering works
            </a>
          </div>
          <div className="mt-10">
            <TrustStrip />
          </div>
        </motion.div>

        {/* Hero collage */}
        <motion.div
          style={{ y: heroShift, opacity: heroFade }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="relative mx-auto hidden aspect-square w-full max-w-md lg:block"
        >
          <div className="woodgrain absolute top-0 right-0 h-[68%] w-[68%] rounded-3xl shadow-card" style={grainStyle(0)} />
          <div className="woodgrain absolute bottom-0 left-0 h-[52%] w-[52%] rounded-3xl shadow-card" style={grainStyle(2)} />
          <motion.div
            initial={{ opacity: 0, y: 20, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: -3 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
            className="absolute bottom-[14%] right-[6%] w-[46%] rounded-2xl bg-white p-4 shadow-lift"
          >
            <p className="text-[11px] font-medium text-muted">Order NY-K2M8 · deposit paid</p>
            <p className="mt-1 font-display text-lg font-semibold">KES 12,500</p>
            <p className="mt-1 text-[11px] text-emerald-600">✓ M-Pesa confirmed</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Shop({
  onOrder,
}: {
  onOrder: (p: Product, i: number) => void;
}) {
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/api/products"),
  });
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(
    () => ["All", ...new Set((products ?? []).map((p) => p.category ?? "Other"))],
    [products],
  );
  const visible = (products ?? []).filter(
    (p) => category === "All" || p.category === category || (!p.category && category === "Other"),
  );

  return (
    <section id="shop" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20">
      <Reveal>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-clay-700 uppercase">
              The collection
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready pieces, honest prices
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === c
                    ? "bg-ink text-paper"
                    : "bg-sand-100 text-ink-soft hover:bg-sand-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl bg-sand-100" />
          ))}
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p, i) => (
            <StaggerItem key={p.id}>
              <motion.button
                onClick={() => onOrder(p, i)}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="group block w-full cursor-pointer overflow-hidden rounded-3xl bg-white text-left shadow-card"
              >
                <ProductImage
                  product={p}
                  index={i}
                  className="h-52 [&>span]:transition-transform [&>span]:duration-500 group-hover:[&>span]:scale-110"
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg leading-snug font-semibold">{p.name}</h3>
                    {p.stockQty <= p.lowStockThreshold && p.stockQty > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        {p.stockQty} left
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="font-display text-base font-semibold">{kes(p.priceKes)}</span>
                    <span className="text-xs font-medium text-clay-700 opacity-0 transition group-hover:opacity-100">
                      View & order →
                    </span>
                  </div>
                </div>
              </motion.button>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}

function HowToOrder() {
  const cfg = usePublicConfig();
  const steps = [
    {
      n: "01",
      title: `Dial ${cfg.ussdServiceCode || "*384*38239#"}`,
      body: "Any phone — feature phone or smartphone. Browse the full catalogue right inside the menu.",
    },
    {
      n: "02",
      title: "Confirm & pay deposit",
      body: "An M-Pesa prompt lands on your phone instantly. Enter your PIN to secure your order.",
    },
    {
      n: "03",
      title: "We craft & deliver",
      body: "Track every step by SMS — from workshop bench to your doorstep.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 bg-ink py-16 text-paper sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.18em] text-clay-300 uppercase">
            Ordering made simple
          </p>
          <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            From keypad to doorstep in three steps
          </h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-8 md:grid-cols-3" gap={0.14}>
          {steps.map((s) => (
            <StaggerItem key={s.n}>
              <div className="relative border-t border-white/15 pt-6">
                <span className="font-display text-4xl font-semibold text-clay-400">{s.n}</span>
                <h3 className="mt-3 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/70">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Craft() {
  return (
    <section id="craft" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="woodgrain relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card" style={grainStyle(4)}>
            <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/90 p-5 backdrop-blur">
              <p className="font-display text-lg font-semibold">Every joint checked twice.</p>
              <p className="mt-1 text-sm text-muted">
                Ten years at the bench. One year warranty on every piece.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="text-xs font-bold tracking-[0.18em] text-clay-700 uppercase">Our craft</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Old-school joinery, modern trust
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            We source seasoned hardwood from certified local suppliers, hand-pick every board,
            and finish with natural oils — no shortcuts, no veneer pretending to be solid wood.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-6">
            {[
              ["10+", "years at the bench"],
              ["1,400+", "pieces delivered"],
              ["12 mo", "warranty, no drama"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-3xl font-semibold text-clay-700">{v}</dt>
                <dd className="mt-1 text-xs leading-snug text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const cfg = usePublicConfig();
  return (
    <footer className="border-t border-sand-200">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-clay-300">
            <Hammer size={14} />
          </span>
          <span className="font-display font-semibold text-ink">{cfg.businessName}</span>
        </div>
        <p>
          {cfg.ownerPhone
            ? `Orders & enquiries: ${formatPhone(cfg.ownerPhone)}`
            : "Orders & enquiries: talk to us"}
          {cfg.ussdServiceCode ? ` · Dial ${cfg.ussdServiceCode}` : ""}
        </p>
        <p className="text-xs">
          Powered by{" "}
          <a
            href="https://africastalking.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-clay-700 underline-offset-2 hover:underline"
          >
            Africa's Talking
          </a>
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  const [ordering, setOrdering] = useState<{ product: Product; index: number } | null>(null);

  return (
    <main id="top">
      <Nav />
      <Hero />
      <Shop onOrder={(product, index) => setOrdering({ product, index })} />
      <HowToOrder />
      <Craft />
      <Footer />
      <OrderDialog
        product={ordering?.product ?? null}
        index={ordering?.index ?? 0}
        onClose={() => setOrdering(null)}
      />
    </main>
  );
}
