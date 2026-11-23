import { PrismaClient } from "@prisma/client";

/** Client Prisma unique du processus. */
export const prisma = new PrismaClient();
export type Prisma = typeof prisma;
