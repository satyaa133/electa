import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS activities TEXT DEFAULT '[]'`;
    console.log("Column added successfully");
  } catch (e) {
    console.error(e);
  }
}
run();
