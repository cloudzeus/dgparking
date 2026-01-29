/**
 * Database Connection Test Script
 * 
 * Tests the database connection to diagnose connection issues.
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function testConnection() {
  console.log("Testing database connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@") || "NOT SET");
  console.log("");

  try {
    // Test basic connection
    await prisma.$connect();
    console.log("✅ Successfully connected to database!");

    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Query test successful:", result);

    // Get database info
    const dbInfo = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() as db`;
    console.log("✅ Current database:", dbInfo[0]?.db);

    // Test table existence
    const dbName = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() as db`;
    const currentDb = dbName[0]?.db;
    if (currentDb) {
      const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ${currentDb}
        LIMIT 5
      `;
      console.log("✅ Found tables:", tables.map((t) => t.TABLE_NAME));
    }

    console.log("\n✅ All tests passed! Database connection is working.");
  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error("Error:", error);

    if (error instanceof Error) {
      console.error("\nError details:");
      console.error("- Message:", error.message);
      console.error("- Name:", error.name);

      // Provide troubleshooting tips
      console.error("\n🔧 Troubleshooting tips:");
      
      if (error.message.includes("Can't reach database server")) {
        console.error("1. Check if the database server is accessible from your network");
        console.error("2. Verify the IP address and port are correct");
        console.error("3. Check firewall rules - port 3333 might be blocked");
        console.error("4. Try using SSL if the server requires it");
        console.error("5. Verify the database user has remote access permissions");
      }

      if (error.message.includes("Access denied")) {
        console.error("1. Check username and password");
        console.error("2. Verify the user has access to the database");
        console.error("3. Check if the user is allowed to connect from your IP");
      }

      if (error.message.includes("Unknown database")) {
        console.error("1. Verify the database name is correct");
        console.error("2. Check if the database exists on the server");
      }

      console.error("\n💡 Common DATABASE_URL formats:");
      console.error("Without SSL:");
      console.error('  mysql://user:password@host:port/database');
      console.error("\nWith SSL:");
      console.error('  mysql://user:password@host:port/database?sslmode=require');
      console.error("\nWith connection pool:");
      console.error('  mysql://user:password@host:port/database?connection_limit=10');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
