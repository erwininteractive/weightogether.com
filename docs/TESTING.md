# Testing Guide

This document provides comprehensive guidance for writing and running tests in the WeighTogether application.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Structure](#test-structure)
- [Best Practices](#best-practices)

## Overview

The project uses Jest as the testing framework with the following features:

- **TypeScript Support**: Via `ts-jest`
- **Unit Tests**: For services, utilities, and business logic
- **Integration Tests**: For API routes and end-to-end flows
- **Test Database**: Separate PostgreSQL database for testing
- **Code Coverage**: Automated coverage reporting
- **CI/CD Integration**: Automated testing via GitHub Actions

## Setup

### 1. Install Dependencies

Testing dependencies are included in the main installation:

```bash
npm install
```

### 2. Configure Test Database

Create a `.env.test` file (or copy from `.env.test.example`):

```bash
PORT=3001
NODE_ENV=test
DATABASE_URL="postgresql://devuser:devpassword@localhost:5433/testdb?schema=public"
JWT_ACCESS_SECRET="test-access-secret-key"
JWT_REFRESH_SECRET="test-refresh-secret-key"
```

### 3. Setup Test Database

**Important**: The test database must be created before running tests.

Create the test database using Docker:

```bash
# Create the test database
docker exec wlt-db-1 psql -U devuser -d devdb -c "CREATE DATABASE testdb;"

# Push the schema to test database
DATABASE_URL="postgresql://devuser:devpassword@localhost:5433/testdb?schema=public" npx prisma db push
```

Or if PostgreSQL is running locally without Docker:

```bash
# Create the test database
psql -U devuser -h localhost -p 5433 -d devdb -c "CREATE DATABASE testdb;"

# Push the schema to test database
DATABASE_URL="postgresql://devuser:devpassword@localhost:5433/testdb?schema=public" npx prisma db push
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

Auto-run tests on file changes:

```bash
npm run test:watch
```

### Coverage Report

Generate code coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory:
- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **Console**: Summary printed to terminal

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### CI Mode

Run tests in CI environment (used by GitHub Actions):

```bash
npm run test:ci
```

### Run Specific Test File

```bash
npm test -- tests/unit/auth.service.test.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should login"
```

## Writing Tests

### Test File Naming

- Unit tests: `*.test.ts` or `*.spec.ts` in `tests/unit/`
- Integration tests: `*.test.ts` or `*.spec.ts` in `tests/integration/`
- Place tests in directories that mirror the source structure

### Unit Test Example

Unit tests focus on testing individual functions or classes in isolation:

```typescript
import { AuthService } from "../../src/services/auth.service";
import { resetDatabase, createTestUser } from "../helpers";

describe("AuthService", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("hashPassword", () => {
		it("should hash a password", async () => {
			const password = "mySecurePassword123";
			const hash = await AuthService.hashPassword(password);

			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
		});

		it("should generate different hashes for same password", async () => {
			const password = "mySecurePassword123";
			const hash1 = await AuthService.hashPassword(password);
			const hash2 = await AuthService.hashPassword(password);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe("register", () => {
		it("should register a new user", async () => {
			const input = {
				email: "newuser@example.com",
				username: "newuser",
				password: "password123",
			};

			const user = await AuthService.register(input);

			expect(user.email).toBe(input.email);
			expect(user.username).toBe(input.username);
		});

		it("should throw error if email already exists", async () => {
			await createTestUser({ email: "existing@example.com" });

			const input = {
				email: "existing@example.com",
				username: "newuser",
				password: "password123",
			};

			await expect(AuthService.register(input)).rejects.toThrow(
				"Email already in use",
			);
		});
	});
});
```

### Integration Test Example

Integration tests verify entire request/response flows:

```typescript
import request from "supertest";
import app from "../../src/server";
import { resetDatabase, createAuthenticatedUser } from "../helpers";

describe("Auth Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("POST /api/auth/register", () => {
		it("should register a new user", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "newuser@example.com",
					username: "newuser",
					password: "password123",
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user).toBeDefined();
			expect(response.body.data.tokens).toBeDefined();
		});

		it("should return 400 for invalid email", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "invalid-email",
					username: "newuser",
					password: "password123",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /api/auth/me", () => {
		it("should return current user with valid token", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${tokens.accessToken}`)
				.expect(200);

			expect(response.body.data.id).toBe(user.id);
		});

		it("should return 401 without token", async () => {
			await request(app).get("/api/auth/me").expect(401);
		});
	});
});
```

## Test Structure

### Directory Structure

```
tests/
├── setup.ts                  # Global test setup
├── helpers/                  # Test utilities and helpers
│   ├── index.ts             # Export all helpers
│   ├── db.ts                # Database utilities
│   └── factories.ts         # Test data factories
├── unit/                    # Unit tests
│   ├── auth.service.test.ts
│   └── ...
└── integration/             # Integration tests
    ├── auth.routes.test.ts
    └── ...
```

### Test Helpers

#### Database Helpers (`tests/helpers/db.ts`)

- `resetDatabase()`: Truncate all tables
- `setupTestDatabase()`: Initialize test database
- `teardownTestDatabase()`: Close connections
- `seedTestData()`: Add common test data

#### Factory Helpers (`tests/helpers/factories.ts`)

- `createTestUser(overrides)`: Create a test user
- `createTestWeightEntry(userId, overrides)`: Create a weight entry
- `createTestTeam(ownerId, overrides)`: Create a team
- `createAuthenticatedUser(overrides)`: Create user with tokens

### Using Factories

```typescript
import { createTestUser, createAuthenticatedUser } from "../helpers";

// Create a basic user
const user = await createTestUser();

// Create a user with custom data
const customUser = await createTestUser({
	email: "custom@example.com",
	username: "customuser",
	displayName: "Custom User",
});

// Create an authenticated user with tokens
const { user, tokens } = await createAuthenticatedUser();
```

## Best Practices

### 1. Clean Database Between Tests

Always reset the database in `beforeEach`:

```typescript
beforeEach(async () => {
	await resetDatabase();
});
```

### 2. Use Descriptive Test Names

```typescript
// Good
it("should return 401 when access token is missing", async () => {});

// Bad
it("test auth", async () => {});
```

### 3. Test One Thing Per Test

```typescript
// Good - one assertion per test
it("should hash a password", async () => {
	const hash = await AuthService.hashPassword("password");
	expect(hash).toBeDefined();
});

it("should not return original password", async () => {
	const password = "password";
	const hash = await AuthService.hashPassword(password);
	expect(hash).not.toBe(password);
});

// Bad - multiple unrelated assertions
it("should work with passwords", async () => {
	const hash = await AuthService.hashPassword("password");
	expect(hash).toBeDefined();
	expect(hash).not.toBe("password");
	const isValid = await AuthService.comparePassword("password", hash);
	expect(isValid).toBe(true);
});
```

### 4. Use Factories for Test Data

```typescript
// Good - using factory
const user = await createTestUser({ email: "test@example.com" });

// Bad - manual creation
const user = await prisma.user.create({
	data: {
		email: "test@example.com",
		username: "testuser123",
		passwordHash: await bcrypt.hash("password", 12),
		displayName: "Test User",
		// ... many more fields
	},
});
```

### 5. Test Error Cases

Always test both success and failure scenarios:

```typescript
describe("login", () => {
	it("should login with valid credentials", async () => {
		// Test success case
	});

	it("should return 401 for invalid email", async () => {
		// Test error case
	});

	it("should return 401 for invalid password", async () => {
		// Test error case
	});

	it("should return 401 for inactive account", async () => {
		// Test error case
	});
});
```

### 6. Mock External Dependencies

For unit tests, mock external dependencies:

```typescript
jest.mock("../../src/services/emailService");

it("should send welcome email on registration", async () => {
	const emailService = require("../../src/services/emailService");
	emailService.sendWelcomeEmail = jest.fn();

	await AuthService.register(input);

	expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
		input.email,
		expect.any(String),
	);
});
```

### 7. Use Async/Await Properly

```typescript
// Good - using async/await
it("should create user", async () => {
	const user = await createTestUser();
	expect(user).toBeDefined();
});

// Bad - not handling promises
it("should create user", () => {
	createTestUser().then((user) => {
		expect(user).toBeDefined();
	});
});
```

### 8. Clean Up Resources

Use `afterAll` to clean up:

```typescript
afterAll(async () => {
	await teardownTestDatabase();
});
```

## Continuous Integration

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline:

1. Sets up Node.js and PostgreSQL
2. Installs dependencies
3. Generates Prisma client
4. Sets up test database
5. Runs linter
6. Runs all tests with coverage
7. Uploads coverage to Codecov (if configured)

View test results in the GitHub Actions tab.

## Debugging Tests

### Run a Single Test

```bash
npm test -- --testNamePattern="should register a new user"
```

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Run Tests in Band (sequentially)

```bash
npm test -- --runInBand
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
	"type": "node",
	"request": "launch",
	"name": "Jest Debug",
	"program": "${workspaceFolder}/node_modules/.bin/jest",
	"args": ["--runInBand", "--no-cache"],
	"console": "integratedTerminal",
	"internalConsoleOptions": "neverOpen"
}
```

## Troubleshooting

### Database Connection Issues

Ensure the test database is running and accessible:

```bash
psql -U devuser -h localhost -p 5433 -d testdb
```

### Port Already in Use

Change the port in `.env.test`:

```bash
PORT=3002
```

### Prisma Client Not Generated

Generate the Prisma client:

```bash
npx prisma generate
```

### Tests Timing Out

Increase timeout in Jest config or individual tests:

```typescript
jest.setTimeout(30000); // 30 seconds

it("long running test", async () => {
	// test code
}, 30000);
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
