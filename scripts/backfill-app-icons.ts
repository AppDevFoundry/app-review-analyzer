import { PrismaClient } from "@prisma/client"
import { fetchAppFromiTunes, extractAppMetadata } from "@/lib/apple/lookup"

const prisma = new PrismaClient()

async function main() {
  console.log("🔄 Backfilling app icons from iTunes Lookup API...\n")

  // Get all apps without icon URLs
  const apps = await prisma.app.findMany({
    where: {
      OR: [
        { iconUrl: null },
        { iconUrl: "" },
      ],
    },
    select: {
      id: true,
      name: true,
      appStoreId: true,
      country: true,
    },
  })

  console.log(`Found ${apps.length} apps without icon URLs\n`)

  let updated = 0
  let failed = 0

  for (const app of apps) {
    console.log(`Processing: ${app.name} (${app.appStoreId})`)

    try {
      const result = await fetchAppFromiTunes(
        app.appStoreId,
        app.country || "us"
      )

      if (!result) {
        console.log(`  ❌ Failed to fetch from iTunes API\n`)
        failed++
        continue
      }

      const metadata = extractAppMetadata(result)

      await prisma.app.update({
        where: { id: app.id },
        data: {
          iconUrl: metadata.iconUrl,
        },
      })

      console.log(`  ✅ Updated with icon: ${metadata.iconUrl}\n`)
      updated++

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`)
      failed++
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`✅ Updated: ${updated}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total: ${apps.length}`)
}

main()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
