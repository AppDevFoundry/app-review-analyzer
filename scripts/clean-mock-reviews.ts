import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const appId = process.argv[2]

  if (!appId) {
    console.log("Usage: pnpm exec tsx scripts/clean-mock-reviews.ts <appId>")
    console.log("\nOr to remove ALL mock reviews (contains 'Mock review' in content):")
    console.log("pnpm exec tsx scripts/clean-mock-reviews.ts --all-mocks")
    process.exit(1)
  }

  if (appId === "--all-mocks") {
    console.log("🧹 Removing all mock reviews...")
    const result = await prisma.review.deleteMany({
      where: {
        OR: [
          {
            title: {
              contains: "Mock Review",
            },
          },
          {
            author: {
              contains: "MockUser",
            },
          },
          {
            content: {
              contains: "This is a mock review for testing purposes",
            },
          },
          {
            content: {
              contains: "This is the content of review",
            },
          },
        ],
      },
    })
    console.log(`✅ Deleted ${result.count} mock reviews`)
  } else {
    console.log(`🧹 Removing all reviews for app: ${appId}`)

    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { name: true, _count: { select: { reviews: true } } },
    })

    if (!app) {
      console.error(`❌ App not found: ${appId}`)
      process.exit(1)
    }

    console.log(`   App: ${app.name}`)
    console.log(`   Current reviews: ${app._count.reviews}`)

    const result = await prisma.review.deleteMany({
      where: { appId },
    })

    console.log(`✅ Deleted ${result.count} reviews`)
  }
}

main()
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
