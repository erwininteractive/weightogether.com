import { teardownTestDatabase } from "./helpers/db";

// Global teardown - close all database connections
module.exports = async () => {
	await teardownTestDatabase();
};
