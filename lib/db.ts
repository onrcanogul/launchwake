import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * Prisma client singleton. In development Next.js hot-reloads modules, which
 * would otherwise open a new pool on every reload and exhaust connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
