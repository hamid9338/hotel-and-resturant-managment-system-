import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` (run from postinstall on every `npm install`, including
// Vercel's build) only needs to read the schema — it never opens a database
// connection. Using env("DATABASE_URL") here would make config loading throw
// whenever the var isn't set yet (a fresh clone, a build before Storage is
// connected), breaking `generate` for no reason. Runtime queries go through
// lib/db.ts's own PrismaPg pool, which reads the real DATABASE_URL directly —
// this fallback is invisible to it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
