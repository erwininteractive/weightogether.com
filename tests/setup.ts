import { config } from "dotenv";
import path from "path";
import { afterAll } from "@jest/globals";
import { teardownTestDatabase } from "./helpers/db";
import { disconnectPrisma } from "../src/services/database";
import { emailService } from "../src/services/email.service";
import { httpServer } from "../src/server";

// Set test environment
process.env.NODE_ENV = "test";

// Only load .env.test if DATABASE_URL is not already set (allows CI to override)
// CI sets DATABASE_URL before running tests, so we don't want to override it
if (!process.env.DATABASE_URL) {
	config({ path: path.resolve(__dirname, "../.env.test") });
	// Fallback if .env.test doesn't exist or doesn't have DATABASE_URL
	if (!process.env.DATABASE_URL) {
		process.env.DATABASE_URL =
			"postgresql://devuser:devpassword@localhost:5433/testdb?schema=public";
	}
}

// Global teardown — close all open handles after tests complete.
// This runs in the same module scope as the tests (unlike globalTeardown),
// so it can actually close the module-level singletons.
afterAll(async () => {
	await teardownTestDatabase();
	await disconnectPrisma();
	emailService.close();
	httpServer.close();
});