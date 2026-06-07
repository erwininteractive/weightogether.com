import { config } from "dotenv";
import path from "path";

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
