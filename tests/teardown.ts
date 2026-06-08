// Global teardown is no longer needed — cleanup is handled by afterAll()
// in tests/setup.ts, which runs in the same module scope as the tests and
// can properly close module-level singletons (Prisma, nodemailer, httpServer).
module.exports = async () => {};