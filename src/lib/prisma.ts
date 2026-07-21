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
      const maxAttempts = 4;
      while (attempts < maxAttempts) {
        try {
          return await query(args);
        } catch (error: any) {
          attempts++;
          const errorMessage = String(error?.message || "");
          const errorCode = error?.code;

          const isConnectionError =
            errorCode === "P1001" ||
            errorCode === "P1002" ||
            errorCode === "P1017" ||
            errorMessage.includes("Can't reach database server") ||
            errorMessage.includes("PrismaClientInitializationError") ||
            errorMessage.includes("terminating connection due to administrator command") ||
            errorMessage.includes("SqlState(E57P01)") ||
            errorMessage.includes("connection pool") ||
            errorMessage.includes("closed connection") ||
            errorMessage.includes("connect ETIMEDOUT") ||
            errorMessage.includes("ECONNRESET") ||
            errorMessage.includes("socket");

          if (isConnectionError && attempts < maxAttempts) {
            console.warn(
              `⚠️ Database connection retry (attempt ${attempts}/${maxAttempts}): ${errorMessage.split("\n")[0]}`
            );
            // Exponential backoff: 500ms, 1200ms, 2500ms
            await new Promise((resolve) => setTimeout(resolve, attempts * 700));
            continue;
          }
          throw error;
        }
      }
    },
  },
});
