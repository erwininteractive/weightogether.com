import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";

// Lazy-load Prisma client to ensure DATABASE_URL is set from test setup
let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
	if (!_prisma) {
		const dbUrl = process.env.DATABASE_URL;
		if (!dbUrl) {
			throw new Error("DATABASE_URL environment variable is not set");
		}
		// Prisma 7 requires the adapter for pg connections
		const adapter = new PrismaPg({ connectionString: dbUrl });
		_prisma = new PrismaClient({ adapter });
	}
	return _prisma;
}

// For backwards compatibility - use a getter proxy
export const prisma = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		return getPrisma()[prop as keyof PrismaClient];
	},
});

/**
 * Reset the test database
 * Truncates all tables to start with a clean state
 */
export async function resetDatabase() {
	// Delete in correct order to respect foreign key constraints
	await prisma.comment.deleteMany();
	await prisma.like.deleteMany();
	await prisma.postRead.deleteMany();
	await prisma.message.deleteMany();
	await prisma.conversation.deleteMany();
	await prisma.userAchievement.deleteMany();
	await prisma.achievement.deleteMany();
	await prisma.challengeParticipant.deleteMany();
	await prisma.challenge.deleteMany();
	await prisma.post.deleteMany();
	await prisma.progressPhoto.deleteMany();
	await prisma.weightEntry.deleteMany();
	await prisma.teamMember.deleteMany();
	await prisma.team.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
}

/**
 * Setup test database
 * Run migrations and prepare database for testing
 */
export async function setupTestDatabase() {
	try {
		// Generate Prisma client with latest schema
		console.log("Generating Prisma client...");
		execSync("npx prisma generate", {
			stdio: "pipe",
		});

		// Push schema to test database with force reset
		console.log("Pushing schema to test database...");
		execSync("npx prisma db push --force-reset --accept-data-loss", {
			env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
			stdio: "pipe",
		});

		console.log("Test database setup complete!");
	} catch (error) {
		console.error("Failed to setup test database");
		throw error;
	}
}

/**
 * Teardown test database connection
 */
export async function teardownTestDatabase() {
	if (_prisma) {
		await _prisma.$disconnect();
		_prisma = null;
	}
}

/**
 * Seed test database with minimal data
 */
export async function seedTestData() {
	// Add common test data here if needed
	// For example, create a test user, etc.
}
