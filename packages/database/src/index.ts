// Single source of truth for the Prisma-generated client, types, and enums.
// Both apps/backend and apps/frontend must consume Prisma exclusively through
// "@repo/database" instead of generating/importing "@prisma/client" directly.
export * from "../generated/client";

export { prisma, withPrismaRetry, ensurePrismaConnected } from "./client";
export { default } from "./client";
