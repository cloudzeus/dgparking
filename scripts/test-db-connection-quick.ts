/**
 * Quick Database Connection Test
 * Tests if database is reachable before running prisma db push
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

async function testConnection() {
  console.log("🔍 Testing database connection...");
  console.log("Host: 5.189.130.31:3333");
  console.log("Database: kolleris_parking_app");
  console.log("");

  try {
    // Test connection with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000)
    );
    
    const connectPromise = prisma.$connect();
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log("✅ Successfully connected to database!");
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Query test successful");
    
    // Check if inst table exists and has NUM01/REMARKS columns
    try {
      const columns = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'kolleris_parking_app' 
        AND TABLE_NAME = 'inst'
        AND COLUMN_NAME IN ('num01', 'remarks')
      `;
      console.log("✅ INST table columns check:", columns.length > 0 ? "NUM01/REMARKS exist" : "NUM01/REMARKS need to be added");
    } catch (err) {
      console.log("⚠️ Could not check columns (table might not exist yet)");
    }
    
    console.log("\n✅ Database is reachable! You can run 'npx prisma db push' now.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    console.error("\nTroubleshooting:");
    console.error("1. Check if database server is running");
    console.error("2. Verify network connectivity to 5.189.130.31:3333");
    console.error("3. Check firewall rules");
    console.error("4. Verify DATABASE_URL in .env file");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
