/**
 * Runs schema.pg.sql against the configured PostgreSQL database.
 * Safe to run multiple times – all statements use IF NOT EXISTS.
 *
 * Usage:
 *   node migrate.js
 *   npm run migrate
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const isRemote = process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("localhost") &&
  !process.env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  options: "--search_path=sports_ems",
});

async function migrate() {
  const sqlFile = path.join(__dirname, "schema.pg.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");

  const client = await pool.connect();
  try {
    console.log("Running migrations against:", process.env.DATABASE_URL.replace(/:\/\/.*@/, "://***@"));
    await client.query(sql);
    console.log("Migration complete – all tables are ready.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
