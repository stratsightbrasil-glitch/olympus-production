import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/olympus",
  },
});