
import { db } from "./server/db";
import { hallTickets } from "./shared/schema";
import { count } from "drizzle-orm";

async function testDB() {
  try {
    console.log("Checking database connection...");
    const result = await db.select({ count: count() }).from(hallTickets);
    console.log("Database connection successful. Hall tickets count:", result[0].count);
  } catch (error) {
    console.error("Database error:", error);
  } finally {
    process.exit();
  }
}

testDB();
