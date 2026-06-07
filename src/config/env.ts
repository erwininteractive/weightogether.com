import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Load environment variables based on NODE_ENV
 * - development: .env.development
 * - production: .env.production
 * - test: .env.test
 * - fallback: .env
 */
function loadEnv(): void {
	const nodeEnv = process.env.NODE_ENV || "development";
	const rootDir = path.resolve(__dirname, "../..");

	// Environment-specific file
	const envFile = `.env.${nodeEnv}`;
	const envPath = path.join(rootDir, envFile);

	// Fallback to .env
	const fallbackPath = path.join(rootDir, ".env");

	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath });
	} else if (fs.existsSync(fallbackPath)) {
		dotenv.config({ path: fallbackPath });
	}
}

// Load immediately when imported
loadEnv();

export { loadEnv };
