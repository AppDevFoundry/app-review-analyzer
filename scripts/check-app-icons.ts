import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const apps = await prisma.app.findMany({
    select: {
      id: true,
      name: true,
      appStoreId: true,
      iconUrl: true,
    },
    take: 10,
  })

  console.log("Apps and their icon URLs:\n")

  apps.forEach((app) => {
    console.log(`${app.name}:`)
    console.log(`  App Store ID: ${app.appStoreId}`)
    console.log(`  Icon URL: ${app.iconUrl || "❌ NULL"}`)
    console.log()
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
