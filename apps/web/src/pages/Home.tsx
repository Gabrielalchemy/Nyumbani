import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Hammer,
  PhoneCall,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Layers,
  Zap,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { api, kes } from "../lib/api";
import { formatPhone, usePublicConfig } from "../lib/config";
import type { Product } from "../lib/types";
import { Reveal, Stagger, StaggerItem, EASE } from "../components/motion";
import { OrderDialog, ProductImage, grainStyle } from "../components/storefront";

// ── Header / Navigation ────────────────────────────────────────────────

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const cfg = usePublicConfig();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-paper/85 shadow-[0_1px_0_0_rgba(18,16,14,0.06)] backdrop-blur-md py-3.5"
          : "bg-transparent py-6"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10 lg:px-12">
        <a href="#top" className="group flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-paper shadow-sm transition-transform duration-300 group-hover:scale-105">
            <Hammer size={18} className="text-clay-300" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              {cfg.businessName}
            </span>
            <span className="text-[10px] font-medium tracking-widest text-muted uppercase">
              Atelier & Commerce
            </span>
          </div>
        </a>

        <div className="hidden items-center gap-9 text-xs font-semibold tracking-wider text-ink-soft uppercase md:flex">
          <a href="#collection" className="transition hover:text-clay-600">
            Collection
          </a>
          <a href="#features" className="transition hover:text-clay-600">
            Architecture
          </a>
          <a href="#craft" className="transition hover:text-clay-600">
            Our Craft
          </a>
          <Link to="/dashboard" className="transition hover:text-clay-600">
            Owner Portal
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="#collection"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-5 py-2.5 text-xs font-semibold tracking-wider text-paper uppercase transition-all duration-300 hover:bg-clay-700 hover:shadow-lift"
          >
            <span>Browse Workshop</span>
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </nav>
    </motion.header>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────

function HeroSection() {
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 600], [0, 90]);
  const heroOpacity = useTransform(scrollY, [0, 480], [1, 0.3]);
  const cfg = usePublicConfig();

  return (
    <section id="top" className="relative min-h-[92vh] overflow-hidden pt-36 pb-24 lg:pt-44 lg:pb-36">
      {/* Abstract Background Accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 size-[640px] rounded-full bg-gradient-to-br from-sand-100/80 via-clay-100/30 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -left-48 size-[500px] rounded-full bg-sand-200/40 blur-3xl"
      />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-12">
        {/* Left Column: Typography & CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="max-w-2xl"
        >
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-sand-200 bg-white/80 px-4 py-1.5 backdrop-blur">
            <span className="size-2 rounded-full bg-clay-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
              {cfg.businessTagline || "Nairobi Master Workshop"}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl leading-[1.05] font-normal tracking-tight text-ink sm:text-6xl lg:text-[4.5rem]">
            Furniture with a soul,{" "}
            <span className="font-italic text-clay-600 italic">built by hand.</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg leading-relaxed text-muted sm:text-xl sm:leading-relaxed">
            Solid mvule, seasoned cypress, and end-grain teak — cut, joined, and oil-finished in our Nairobi workshop. Order from any phone via USSD, authenticated instantly with M-Pesa.
          </p>

          {/* Call to Actions */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#collection"
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-ink px-8 font-sans text-sm font-semibold tracking-wider text-paper shadow-lift transition-all duration-300 hover:bg-clay-700"
            >
              <span>Browse Catalogue</span>
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            {cfg.ussdServiceCode && (
              <a
                href="#how-it-works"
                className="group inline-flex h-14 items-center gap-3 rounded-full border border-sand-200 bg-white/70 px-7 font-sans text-sm font-medium text-ink backdrop-blur transition-all duration-300 hover:border-sand-300 hover:bg-white"
              >
                <PhoneCall size={16} className="text-clay-600 transition-transform duration-300 group-hover:rotate-12" />
                <span>Dial <strong className="font-semibold">{cfg.ussdServiceCode}</strong></span>
              </a>
            )}
          </div>

          {/* Trust Strip */}
          <div className="mt-14 border-t border-sand-200/80 pt-8">
            <p className="text-xs font-bold tracking-[0.2em] text-muted uppercase">
              Direct Channels · No App Required
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-semibold tracking-wider text-ink-soft">
              <span className="flex items-center gap-2">
                <Smartphone size={15} className="text-clay-600" /> Feature Phone & Smartphone USSD
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-clay-600" /> Safaricom M-Pesa STK Push
              </span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Editorial Hero Mask & Showcase */}
        <motion.div
          style={{ y: heroParallax, opacity: heroOpacity }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.2 }}
          className="relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none"
        >
          {/* Main Editorial Image Card */}
          <div className="woodgrain absolute inset-0 overflow-hidden rounded-3xl shadow-card" style={grainStyle(0)}>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-paper">
              <p className="text-xs font-bold tracking-widest text-clay-300 uppercase">
                Artisan Series
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold">
                Mvule Coffee Table
              </h3>
              <p className="mt-1 text-xs text-paper/80">
                110 × 60 × 45 cm · Hand-rubbed organic oil
              </p>
            </div>
          </div>

          {/* Floating Live Transaction Badge */}
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
            className="absolute -bottom-6 -left-6 max-w-[240px] rounded-2xl border border-sand-100 bg-white/95 p-5 shadow-lift backdrop-blur sm:-left-8"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-wider text-muted uppercase">
                Live Order
              </span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold text-ink">
              KES 12,500
            </p>
            <p className="mt-0.5 text-xs text-emerald-700 font-medium">
              ✓ M-Pesa Deposit Confirmed
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Social Proof / Minimal Partner Strip ───────────────────────────────

function SocialProofSection() {
  return (
    <section className="border-y border-sand-200 bg-sand-100/50 py-12">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
        <p className="text-center text-xs font-bold tracking-[0.22em] text-muted uppercase">
          Powered by Infrastructure built for Africa
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-10 opacity-75 grayscale transition duration-300 hover:grayscale-0 sm:gap-16">
          <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <span className="size-2 rounded-full bg-clay-600" /> Africa's Talking USSD
          </div>
          <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <span className="size-2 rounded-full bg-emerald-600" /> Safaricom M-Pesa STK
          </div>
          <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <span className="size-2 rounded-full bg-clay-500" /> Google Gemini 1.5 Flash
          </div>
          <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <span className="size-2 rounded-full bg-ink" /> Fastify & PostgreSQL
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Bento-Box Features Section ─────────────────────────────────────────

function FeaturesSection() {
  const cfg = usePublicConfig();

  return (
    <section id="features" className="scroll-mt-24 py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.22em] text-clay-600 uppercase">
              System Architecture
            </p>
            <h2 className="mt-3 font-display text-4xl font-normal tracking-tight text-ink sm:text-5xl">
              Engineered for absolute reach & effortless commerce.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Every component is crafted to bridge offline manufacturing with instant digital transactions.
            </p>
          </div>
        </Reveal>

        {/* Bento Grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-3 lg:grid-cols-3">
          {/* Bento Card 1 (Large 2-Column Span): USSD Keypad Channel */}
          <Reveal className="md:col-span-2">
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-sand-200 bg-white p-8 shadow-card transition-all duration-500 hover:shadow-lift lg:p-10">
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-sand-100 text-clay-600">
                  <Smartphone size={22} />
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-ink">
                  Universal USSD Channel ({cfg.ussdServiceCode || "*384*38239#"})
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
                  Customers dial from any phone — feature phone or smartphone — without internet or app installation. Browse product paginations, select quantities, and confirm orders directly from their keypad.
                </p>
              </div>

              {/* Interactive USSD Preview Box */}
              <div className="mt-8 rounded-2xl border border-sand-200 bg-sand-100/60 p-5 font-mono text-xs text-ink-soft">
                <p className="text-muted">CON Karibu {cfg.businessName}</p>
                <p className="mt-1 font-semibold text-ink">1. Browse products</p>
                <p>2. My orders</p>
                <p>3. Contact us</p>
              </div>
            </div>
          </Reveal>

          {/* Bento Card 2: Direct M-Pesa STK Push */}
          <Reveal delay={0.1}>
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-sand-200 bg-white p-8 shadow-card transition-all duration-500 hover:shadow-lift lg:p-10">
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Zap size={22} />
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-ink">
                  Instant M-Pesa STK Push
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Selecting an order pushes a live Safaricom M-Pesa PIN prompt directly to the customer's phone. Deposit payments update order status to confirmed in real-time.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
                <span>Lipa na M-Pesa Online</span>
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5">Instant STK</span>
              </div>
            </div>
          </Reveal>

          {/* Bento Card 3: Atomic Inventory Control */}
          <Reveal delay={0.15}>
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-sand-200 bg-white p-8 shadow-card transition-all duration-500 hover:shadow-lift lg:p-10">
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-sand-100 text-clay-600">
                  <Layers size={22} />
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-ink">
                  Atomic Stock Safeguard
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Every order conditionally decrements stock inside a single database transaction. Zero overselling, guaranteed under concurrent high traffic.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between text-xs font-medium text-muted">
                <span>Low stock threshold SMS alerts</span>
                <span className="font-semibold text-clay-600">Auto Trigger</span>
              </div>
            </div>
          </Reveal>

          {/* Bento Card 4 (Large 2-Column Span): AI Invoice & Expense Insights */}
          <Reveal delay={0.2} className="md:col-span-2">
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-sand-200 bg-ink p-8 text-paper shadow-lift transition-all duration-500 lg:p-10">
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-clay-300">
                  <Sparkles size={22} />
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-paper">
                  Gemini 1.5 Flash AI Insights
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-paper/75">
                  Upload raw supplier receipts and invoices. Google Gemini extracts line items, quantities, and categories automatically — generating executive business reports sent to your phone.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-paper/80">
                <span className="flex items-center gap-2 font-medium">
                  <MessageSquare size={14} className="text-clay-300" /> One-tap SMS Executive Digest
                </span>
                <span className="font-semibold text-clay-300">PDF & Image Extraction</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Interactive Collection Showcase ────────────────────────────────────

function CollectionSection({
  onOrder,
}: {
  onOrder: (p: Product, i: number) => void;
}) {
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/api/products"),
  });
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = useMemo(
    () => ["All", ...new Set((products ?? []).map((p) => p.category ?? "Other"))],
    [products]
  );
  const visibleProducts = (products ?? []).filter(
    (p) => activeCategory === "All" || p.category === activeCategory || (!p.category && activeCategory === "Other")
  );

  return (
    <section id="collection" className="scroll-mt-24 bg-sand-100/40 py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.22em] text-clay-600 uppercase">
                Curated Catalogue
              </p>
              <h2 className="mt-3 font-display text-4xl font-normal tracking-tight text-ink sm:text-5xl">
                Ready Workshop Pieces
              </h2>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold tracking-wider transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-ink text-paper shadow-sm"
                      : "bg-white text-ink-soft hover:bg-sand-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {isLoading ? (
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-3xl bg-sand-200/60" />
            ))}
          </div>
        ) : (
          <Stagger className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product, idx) => (
              <StaggerItem key={product.id}>
                <motion.button
                  onClick={() => onOrder(product, idx)}
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="group block w-full cursor-pointer overflow-hidden rounded-3xl border border-sand-200 bg-white text-left shadow-card transition-shadow duration-300 hover:shadow-lift"
                >
                  <ProductImage
                    product={product}
                    index={idx}
                    className="h-60 w-full [&>span]:transition-transform [&>span]:duration-700 group-hover:[&>span]:scale-110"
                  />
                  <div className="p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold text-ink">
                        {product.name}
                      </h3>
                      {product.stockQty <= product.lowStockThreshold && product.stockQty > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                          {product.stockQty} left
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                      {product.description || "Handcrafted timber furniture piece."}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-sand-100 pt-5">
                      <span className="font-display text-lg font-semibold text-ink">
                        {kes(product.priceKes)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-clay-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        Order Piece <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </motion.button>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}

// ── Editorial Craft Story Section ─────────────────────────────────────

function CraftSection() {
  return (
    <section id="craft" className="scroll-mt-24 py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <div className="woodgrain relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card" style={grainStyle(3)}>
              <div className="absolute inset-x-8 bottom-8 rounded-2xl border border-white/40 bg-white/90 p-6 backdrop-blur">
                <p className="font-display text-xl font-semibold text-ink">
                  Every joint inspected twice.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Mortise and tenon joinery built to endure generations. One year workshop warranty included.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div>
              <p className="text-xs font-bold tracking-[0.22em] text-clay-600 uppercase">
                Our Heritage
              </p>
              <h2 className="mt-3 font-display text-4xl font-normal tracking-tight text-ink sm:text-5xl">
                Old-school joinery, modern trust.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted">
                We select seasoned local hardwood, hand-flatten every board, and apply non-toxic natural oils. No synthetic veneers pretending to be timber — just authentic African artisanry.
              </p>
              <dl className="mt-10 grid grid-cols-3 gap-8 border-t border-sand-200 pt-8">
                {[
                  ["10+", "years experience"],
                  ["1,400+", "delivered pieces"],
                  ["12 mo", "full warranty"],
                ].map(([val, label]) => (
                  <div key={label}>
                    <dt className="font-display text-3xl font-semibold text-clay-700">{val}</dt>
                    <dd className="mt-1 text-xs font-medium leading-snug text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────

function FooterSection() {
  const cfg = usePublicConfig();

  return (
    <footer className="border-t border-sand-200 bg-ink text-paper">
      {/* Upper Subtle CTA */}
      <div className="border-b border-white/10 py-16">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h3 className="font-display text-3xl font-normal text-paper sm:text-4xl">
                Ready to order your custom piece?
              </h3>
              <p className="mt-2 text-sm text-paper/70">
                Dial {cfg.ussdServiceCode || "*384*38239#"} or order directly online.
              </p>
            </div>
            <a
              href="#collection"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-7 font-sans text-xs font-semibold tracking-wider text-ink uppercase transition hover:bg-sand-100"
            >
              Explore Workshop <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row text-xs text-paper/60">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-clay-300">
              <Hammer size={14} />
            </span>
            <span className="font-display font-semibold text-paper text-sm">
              {cfg.businessName}
            </span>
          </div>

          <p>
            {cfg.ownerPhone ? `Contact: ${formatPhone(cfg.ownerPhone)}` : "Contact us"}
            {cfg.ussdServiceCode ? ` · Dial ${cfg.ussdServiceCode}` : ""}
          </p>

          <p>
            Powered by{" "}
            <a
              href="https://africastalking.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-clay-300 underline-offset-2 hover:underline"
            >
              Africa's Talking
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Main Page Export ───────────────────────────────────────────────────

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<{
    product: Product;
    index: number;
  } | null>(null);

  return (
    <main id="top" className="bg-paper font-sans text-ink antialiased">
      <Navigation />
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <CollectionSection
        onOrder={(product, index) => setSelectedProduct({ product, index })}
      />
      <CraftSection />
      <FooterSection />

      <OrderDialog
        product={selectedProduct?.product ?? null}
        index={selectedProduct?.index ?? 0}
        onClose={() => setSelectedProduct(null)}
      />
    </main>
  );
}
