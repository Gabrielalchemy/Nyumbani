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
      name: "Teak Cutting Board",
      description: "End-grain teak chopping board, food-safe finish. 40 × 30 cm.",
      category: "Kitchen",
      priceKes: 850,
      stockQty: 25,
      lowStockThreshold: 6,
      imageUrl: "/images/teak_cutting_board.jpg",
      lowStockThreshold: 2,
      imageUrl: "/images/industrial_bookshelf.jpg",
    },
    {
      description: "Classic carved mahogany dining chair with cushioned upholstery. Sold per piece.",
      category: "Dining",
      priceKes: 4500,
      stockQty: 12,
      imageUrl: "/images/carved_dining_chair.jpg",
    },
    {
      name: "Floating Wall Shelf",
      category: "Storage",
      priceKes: 2200,
      stockQty: 18,
      lowStockThreshold: 5,
    },
    {
      name: "Garden Bench",
      description: "Weatherproofed cast-iron & timber two-seater bench for verandahs and gardens.",
      priceKes: 9800,
      stockQty: 3,
      lowStockThreshold: 2,
      imageUrl: "/images/wrought_iron_bench.jpg",
    {
      name: "Mvule Coffee Table",
      description: "Solid mvule hardwood coffee table, hand-finished with natural organic oil. 110 × 60 × 45 cm.",
      category: "Living Room",
      stockQty: 4,
      lowStockThreshold: 2,
      imageUrl: "/images/teak_cutting_board.jpg",
    },

  for (const p of products) {
    await prisma.product.create({
      data: {
        ...p,
        stockMovements: {
          create: { delta: p.stockQty, reason: "INITIAL", note: "Opening stock" },
        },
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
