import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding demo catalog…");

  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();

  const products = [
    {
      name: "Mvule Coffee Table",
      description:
        "Solid mvule hardwood coffee table, hand-finished with natural oil. 110 × 60 × 45 cm.",
      category: "Living Room",
      priceKes: 12500,
      stockQty: 4,
      lowStockThreshold: 2,
    },
    {
      name: "Bookshelf — 5 Tier",
      description: "Five-tier bookshelf in seasoned cypress. Sturdy enough for a workshop library.",
      category: "Storage",
      priceKes: 18500,
      stockQty: 2,
      lowStockThreshold: 2,
    },
    {
      name: "Dining Chair (each)",
      description: "Classic mortise-and-tenon dining chair. Sold per piece; sets of 4 available.",
      category: "Dining",
      priceKes: 4500,
      stockQty: 12,
      lowStockThreshold: 4,
    },
    {
      name: "Floating Wall Shelf",
      description: "Minimal floating shelf, 90 cm. Hidden brackets included.",
      category: "Storage",
      priceKes: 2200,
      stockQty: 18,
      lowStockThreshold: 5,
    },
    {
      name: "Garden Bench",
      description: "Weatherproofed two-seater bench for verandahs and gardens.",
      category: "Outdoor",
      priceKes: 9800,
      stockQty: 3,
      lowStockThreshold: 2,
    },
    {
      name: "Teak Cutting Board",
      description: "End-grain teak chopping board, food-safe finish. 40 × 30 cm.",
      category: "Kitchen",
      priceKes: 850,
      stockQty: 25,
      lowStockThreshold: 6,
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        ...p,
        stockMovements: {
          create: { delta: p.stockQty, reason: "INITIAL", note: "Opening stock" },
        },
      },
    });
  }

  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
