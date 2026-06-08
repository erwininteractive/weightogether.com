import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "../config/env";

// Prisma 7 pattern: pass connectionString directly to adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

export default prisma;

/**
 * Disconnect the Prisma client and underlying connection pool.
 * Called during test teardown to prevent Jest from hanging on open handles.
 */
export async function disconnectPrisma(): Promise<void> {
	await prisma.$disconnect();
}