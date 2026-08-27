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
      description: "End-grain teak chopping board with natural antibacterial oils and a food-safe wax finish. 40 × 30 cm.",
      category: "Kitchen",
      priceKes: 850,
      stockQty: 25,
      lowStockThreshold: 6,
      imageUrl: "/images/teak_cutting_board.jpg",
    },
    {
      name: "Industrial Bookshelf",
      description: "Five-tier architectural shelving unit with matte black steel framing and solid cypress timber planks.",
      category: "Storage",
      priceKes: 18500,
      stockQty: 5,
      lowStockThreshold: 2,
      imageUrl: "/images/industrial_bookshelf.jpg",
    },
    {
      name: "Carved Dining Chair",
      description: "Hand-carved solid mahogany dining chair with curved back support and textured woven upholstery.",
      category: "Dining",
      priceKes: 4500,
      stockQty: 12,
      lowStockThreshold: 4,
      imageUrl: "/images/carved_dining_chair.jpg",
    },
    {
      name: "Floating Wall Shelf",
      description: "Live-edge seasoned hardwood floating shelves with heavy-duty concealed wall mounts. Set of 3.",
      category: "Storage",
      priceKes: 2200,
      stockQty: 18,
      lowStockThreshold: 5,
      imageUrl: "/images/floating_timber_shelves.jpg",
    },
    {
      name: "Garden Bench",
      description: "Weather-resistant cast iron filigree frame and kiln-dried treated timber bench for verandahs and patios.",
      category: "Outdoor",
      priceKes: 9800,
      stockQty: 3,
      lowStockThreshold: 2,
      imageUrl: "/images/wrought_iron_bench.jpg",
    },
    {
      name: "Mvule Coffee Table",
      description: "Solid mvule hardwood coffee table with artisan butterfly key joinery and organic matte oil finish.",
      category: "Living Room",
      priceKes: 14500,
      stockQty: 4,
      lowStockThreshold: 2,
      imageUrl: "/images/mvule_coffee_table.jpg",
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
