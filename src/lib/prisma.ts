import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: any };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }: any) {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          return await query(args);
        } catch (error: any) {
          attempts++;
          const errorMessage = error?.message || "";
          const isConnectionError =
            errorMessage.includes("terminating connection due to administrator command") ||
            errorMessage.includes("SqlState(E57P01)") ||
            errorMessage.includes("connection pool") ||
            errorMessage.includes("closed connection") ||
            errorMessage.includes("socket");

          if (isConnectionError && attempts < maxAttempts) {
            console.warn(
              `⚠️ Prisma connection lost (E57P01 / Neon idle). Retrying query (attempt ${attempts}/${maxAttempts})...`
            );
            // Exponential backoff: 500ms, 1000ms
            await new Promise((resolve) => setTimeout(resolve, attempts * 500));
            continue;
          }
          throw error;
        }
      }
    },
  },
});

