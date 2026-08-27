import { prisma } from "../../lib/db.js";
import { config } from "../../config.js";
import { kes } from "../../lib/money.js";
import { STATUS_LABELS } from "../../lib/templates.js";
import { placeOrder } from "../orders/service.js";
import { stkPush } from "../../lib/mpesa.js";

const PAGE_SIZE = 4;
const BACK = "9";
const HOME = "0";

interface SessionData {
  page?: number;
  productId?: string;
  qty?: number;
  /** remembered so "Back" returns you where you were */
  lastPage?: number;
}

interface ScreenResult {
  screen: keyof typeof SCREENS;
  data?: SessionData;
  end: boolean;
  text: string;
}

const SCREENS = {
  MAIN: "MAIN",
  PRODUCT_LIST: "PRODUCT_LIST",
  PRODUCT_DETAIL: "PRODUCT_DETAIL",
  ORDER_QTY: "ORDER_QTY",
  ORDER_CONFIRM: "ORDER_CONFIRM",
  MY_ORDERS: "MY_ORDERS",
  CONTACT: "CONTACT",
} as const;

function con(text: string): string {
  return `CON ${text}`;
}
function end(text: string): string {
  return `END ${text}`;
}

async function loadSession(sessionId: string, phone: string) {
  return prisma.ussdSession.upsert({
    where: { id: sessionId },
    update: { updatedAt: new Date() },
    create: { id: sessionId, phone },
  });
}

// ── Screen renderers ───────────────────────────────────────────────────

function mainMenu(): ScreenResult {
  return {
    screen: "MAIN",
    end: false,
    text: [
      `Karibu ${config.BUSINESS_NAME}`,
      config.BUSINESS_TAGLINE,
      "",
      "1. Browse products",
      "2. My orders",
      "3. Contact us",
    ].join("\n"),
  };
}

async function productList(page: number): Promise<ScreenResult> {
  const products = await prisma.product.findMany({
    where: { visible: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const hasNext = products.length > PAGE_SIZE;
  const visible = products.slice(0, PAGE_SIZE);

  if (visible.length === 0) {
    return {
      screen: "PRODUCT_LIST",
      data: { page },
      end: true,
      text: "No products available right now. Please check back soon.",
    };
  }

  const lines = ["Products:", ""];
  visible.forEach((p, i) => {
    const stockTag = p.stockQty === 0 ? " (sold out)" : "";
    lines.push(`${i + 1}. ${p.name} - ${kes(p.priceKes)}${stockTag}`);
  });

  let nextOption: number | null = null;
  if (hasNext) {
    nextOption = visible.length + 1;
    lines.push(`${nextOption}. Next`);
  }
  lines.push(`${HOME}. Main menu`);

  return {
    screen: "PRODUCT_LIST",
    data: { page },
    end: false,
    text: lines.join("\n"),
  };
}

async function productDetail(productId: string, lastPage = 0): Promise<ScreenResult> {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || !p.visible) {
    return { ...mainMenu(), text: `Sorry, that item is unavailable.\n\n${mainMenu().text}` };
  }

  const stockLine =
    p.stockQty === 0
      ? "Out of stock"
      : p.stockQty <= p.lowStockThreshold
        ? `Only ${p.stockQty} left!`
        : `${p.stockQty} available`;

  const lines = [`${p.name}`, kes(p.priceKes), stockLine];
  if (p.description) lines.push("", p.description.slice(0, 120));
  lines.push("");
  if (p.stockQty > 0) lines.push("1. Order this");
  lines.push(`${BACK}. Back`, `${HOME}. Main menu`);

  return { screen: "PRODUCT_DETAIL", data: { productId, lastPage }, end: false, text: lines.join("\n") };
}

async function orderQtyPrompt(productId: string, lastPage = 0, error?: string): Promise<ScreenResult> {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) return mainMenu();

  return {
    screen: "ORDER_QTY",
    data: { productId, lastPage },
    end: false,
    text: [error, "", `${p.name} (${kes(p.priceKes)} each)`, `Available: ${p.stockQty}`, "", "Enter quantity:"]
      .filter(Boolean)
      .join("\n"),
  };
}

async function orderConfirm(productId: string, qty: number, lastPage = 0): Promise<ScreenResult> {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) return mainMenu();

  const total = p.priceKes * qty;
  return {
    screen: "ORDER_CONFIRM",
    data: { productId, qty, lastPage },
    end: false,
    text: [
      "Confirm your order:",
      "",
      `${qty} x ${p.name}`,
      `Total: ${kes(total)}`,
      "",
      "1. Confirm & pay deposit (M-Pesa)",
      "2. Confirm (arrange payment later)",
      `${BACK}. Back`,
      `${HOME}. Main menu`,
    ].join("\n"),
  };
}

async function myOrders(phone: string): Promise<ScreenResult> {
  const customer = await prisma.customer.findUnique({
    where: { phone },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 3, include: { items: { include: { product: true } } } },
    },
  });

  if (!customer || customer.orders.length === 0) {
    return {
      screen: "MY_ORDERS",
      end: false,
      text: `You have no orders yet.\n\n${HOME}. Main menu`,
    };
  }

  const lines = ["Your recent orders:", ""];
  for (const o of customer.orders) {
    const itemNames = o.items.map((i) => `${i.qty}x ${i.product.name}`).join(", ");
    lines.push(
      `${o.reference} - ${STATUS_LABELS[o.status] ?? o.status}`,
      `  ${itemNames} | ${kes(o.totalKes)}`
    );
  }
  lines.push("", `${HOME}. Main menu`);

  return { screen: "MY_ORDERS", end: false, text: lines.join("\n") };
}

function contact(): ScreenResult {
  return {
    screen: "CONTACT",
    end: true,
    text: `Talk to us: ${config.OWNER_PHONE}\nWe're happy to help. Karibu tena!`,
  };
}

// ── Order placement ────────────────────────────────────────────────────

async function confirmOrder(
  phone: string,
  productId: string,
  qty: number,
  payNow: boolean
): Promise<ScreenResult> {
  try {
    const order = await placeOrder({
      phone,
      items: [{ productId, qty }],
      channel: "USSD",
      depositPrompted: payNow,
    });

    if (!payNow) {
      return {
        screen: "CONTACT",
        end: true,
        text: `Asante! Order ${order.reference} received (${kes(order.totalKes)}).\nWe'll call you to arrange payment & delivery.`,
      };
    }

    // Trigger M-Pesa deposit push (Daraja STK)
    const checkout = await stkPush({
      phoneNumber: phone,
      amountKes: order.totalKes,
      accountReference: order.reference,
      description: "Order deposit",
      callbackUrl: `${config.PUBLIC_BASE_URL.replace(/\/+$/, "")}/webhooks/mpesa`,
    });

    if (checkout.ok && checkout.checkoutRequestId) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          providerRef: checkout.checkoutRequestId,
          amountKes: order.totalKes,
          method: "MPESA",
          status: "INITIATED",
        },
      });
    }

    return {
      screen: "CONTACT",
      end: true,
      text: checkout.ok && checkout.checkoutRequestId
        ? `Asante! Order ${order.reference} received.\nTotal: ${kes(order.totalKes)}. Check your phone for the M-Pesa prompt and enter your PIN.`
        : `Asante! Order ${order.reference} received.\nPayment prompt couldn't be sent — we'll contact you shortly.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    return { screen: "CONTACT", end: true, text: `Sorry: ${msg}` };
  }
}

// ── Router ─────────────────────────────────────────────────────────────

export async function handleUssd(params: {
  sessionId: string;
  phoneNumber: string;
  text: string;
}): Promise<string> {
  const session = await loadSession(params.sessionId, params.phoneNumber);

  // AT sends the full input history joined by '*'; only the newest entry matters here.
  const segments = params.text.split("*").filter((s) => s.trim() !== "");
  const input = segments[segments.length - 1] ?? "";

  const result = await route(session.screen as keyof typeof SCREENS, session.data as SessionData, input, params.phoneNumber);

  await prisma.ussdSession.update({
    where: { id: params.sessionId },
    data: {
      screen: result.screen,
      data: (result.data ?? {}) as object,
    },
  });

  return result.end ? end(result.text) : con(result.text);
}

async function route(
  screen: keyof typeof SCREENS,
  data: SessionData,
  input: string,
  phone: string
): Promise<ScreenResult> {
  switch (screen) {
    case "MAIN": {
      if (input === "1") return productList(0);
      if (input === "2") return myOrders(phone);
      if (input === "3") return contact();
      return mainMenu();
    }

    case "PRODUCT_LIST": {
      if (input === HOME) return mainMenu();
      if (input === "") return productList(data.page ?? 0);

      const page = data.page ?? 0;
      const products = await prisma.product.findMany({
        where: { visible: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      });
      const visible = products.slice(0, PAGE_SIZE);
      const nextOption = products.length > PAGE_SIZE ? String(visible.length + 1) : null;

      if (nextOption !== null && input === nextOption) return productList(page + 1);

      const idx = parseInt(input, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= visible.length) {
        return productDetail(visible[idx - 1].id, page);
      }
      return productList(page);
    }

    case "PRODUCT_DETAIL": {
      const pid = data.productId!;
      const page = data.lastPage ?? 0;
      if (input === "1") return orderQtyPrompt(pid, page);
      if (input === BACK) return productList(page);
      if (input === HOME) return mainMenu();
      return productDetail(pid, page);
    }

    case "ORDER_QTY": {
      const pid = data.productId!;
      const page = data.lastPage ?? 0;
      if (input === HOME) return mainMenu();
      if (input === BACK) return productDetail(pid, page);

      const qty = parseInt(input, 10);
      if (Number.isNaN(qty) || qty < 1)
        return orderQtyPrompt(pid, page, "Please enter a valid quantity.");

      const p = await prisma.product.findUnique({ where: { id: pid } });
      if (!p) return mainMenu();
      if (qty > p.stockQty)
        return orderQtyPrompt(pid, page, `Sorry, only ${p.stockQty} available.`);

      return orderConfirm(pid, qty, page);
    }

    case "ORDER_CONFIRM": {
      const { productId: pid, qty } = data;
      const page = data.lastPage ?? 0;
      if (input === HOME) return mainMenu();
      if (input === BACK) return productDetail(pid!, page);
      if (input === "1") return confirmOrder(phone, pid!, qty!, true);
      if (input === "2") return confirmOrder(phone, pid!, qty!, false);
      return orderConfirm(pid!, qty!, page);
    }

    case "MY_ORDERS":
    case "CONTACT":
    default:
      if (input === "" || input === HOME) return mainMenu();
      return mainMenu();
  }
}
