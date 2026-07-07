import "dotenv/config";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import dotenv from "dotenv";

// Ensure .env is loaded from the root directory when running from subdirectories.
// Uses process.cwd() instead of import.meta.url so this also works when bundled
// to CommonJS for production (import.meta is unavailable in CJS output).
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  db = drizzle(pool, { schema });
} else {
  console.warn("[AI Studio] DATABASE_URL is not set. Falling back to MemStorage.");
}
