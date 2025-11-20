import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Check for tables
    const tables: any[] = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
    `;

    console.log("\n📊 Tables in database:");
    tables.forEach((t) => console.log(`  - ${t.tablename}`));

    // Check for data
    const appsCount = await prisma.app.count();
    const reviewsCount = await prisma.review.count();
    const usersCount = await prisma.user.count();
    const workspacesCount = await prisma.workspace.count();

    console.log("\n📈 Record counts:");
    console.log(`  - Users: ${usersCount}`);
    console.log(`  - Workspaces: ${workspacesCount}`);
    console.log(`  - Apps: ${appsCount}`);
    console.log(`  - Reviews: ${reviewsCount}`);

    // Check database name
    const dbInfo: any[] = await prisma.$queryRaw`
      SELECT current_database(), current_user
    `;
    console.log("\n🔌 Connection info:");
    console.log(`  - Database: ${dbInfo[0].current_database}`);
    console.log(`  - User: ${dbInfo[0].current_user}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
