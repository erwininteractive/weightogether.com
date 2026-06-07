# Tests

This directory contains all test files for the WeighTogether application.

## Quick Start

### Setup Test Database

1. Create the test database:

```bash
# If using Docker (recommended)
docker exec -it <postgres-container-name> psql -U devuser -c "CREATE DATABASE testdb;"

# Or connect directly to PostgreSQL
psql -U devuser -h localhost -p 5433 -c "CREATE DATABASE testdb;"
```

1. Push the schema to test database:

```bash
DATABASE_URL="postgresql://devuser:devpassword@localhost:5433/testdb?schema=public"
npx prisma db push
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

## Directory Structure

```
tests/
├── README.md                      # This file
├── setup.ts                       # Global test configuration
├── helpers/                       # Test utilities
│   ├── index.ts                  # Exports all helpers
│   ├── db.ts                     # Database utilities
│   └── factories.ts              # Test data factories
├── unit/                         # Unit tests
│   └── auth.service.test.ts     # AuthService unit tests
└── integration/                  # Integration tests
    └── auth.routes.test.ts      # Auth routes integration tests
```

## Test Helpers

### Database Helpers

- `resetDatabase()`: Truncate all tables (use in `beforeEach`)
- `setupTestDatabase()`: Initialize test database schema
- `teardownTestDatabase()`: Close database connections
- `seedTestData()`: Seed common test data

### Factory Helpers

- `createTestUser(overrides?)`: Create a test user
- `createTestWeightEntry(userId, overrides?)`: Create a weight entry
- `createTestTeam(ownerId, overrides?)`: Create a team
- `createTestTeamMember(teamId, userId, role?)`: Create team membership
- `createAuthenticatedUser(overrides?)`: Create user with JWT tokens

## Writing Tests

### Basic Structure

```typescript
import { resetDatabase, createTestUser } from "../helpers";

describe("Feature Name", () => {
 beforeEach(async () => {
  await resetDatabase(); // Clean database before each test
 });

 it("should do something", async () => {
  // Arrange
  const user = await createTestUser();

  // Act
  const result = await someFunction(user.id);

  // Assert
  expect(result).toBeDefined();
 });
});
```

### Integration Test Structure

```typescript
import request from "supertest";
import app from "../../src/server";
import { resetDatabase, createAuthenticatedUser } from "../helpers";

describe("API Endpoint", () => {
 beforeEach(async () => {
  await resetDatabase();
 });

 it("should return data", async () => {
  const { tokens } = await createAuthenticatedUser();

  const response = await request(app)
   .get("/api/endpoint")
   .set("Authorization", `Bearer ${tokens.accessToken}`)
   .expect(200);

  expect(response.body.success).toBe(true);
 });
});
```

## Best Practices

1. **Always reset database in beforeEach**

    ```typescript
    beforeEach(async () => {
     await resetDatabase();
    });
    ```

2. **Use factories for test data**

    ```typescript
    const user = await createTestUser({ email: "test@example.com" });
    ```

3. **Test both success and error cases**

    ```typescript
    it("should succeed with valid data", async () => {
     /* ... */
    });
    it("should fail with invalid data", async () => {
     /* ... */
    });
    ```

4. **Use descriptive test names**

    ```typescript
    // Good
    it("should return 401 when access token is missing", async () => {});

    // Bad
    it("test auth", async () => {});
    ```

5. **One assertion per test (when possible)**

    ```typescript
    // Good - focused test
    it("should return user email", async () => {
     const user = await createTestUser();
     expect(user.email).toBeDefined();
    });

    // Okay - related assertions
    it("should create user with defaults", async () => {
     const user = await createTestUser();
     expect(user.unitSystem).toBe("IMPERIAL");
     expect(user.isActive).toBe(true);
    });
    ```

## Coverage

View coverage reports:

1. Generate coverage: `npm run test:coverage`
2. Open HTML report: `open coverage/lcov-report/index.html`

Current coverage goals:

- **Overall**: 80%+
- **Services**: 90%+
- **Controllers**: 80%+
- **Middleware**: 85%+

## CI/CD

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Database Connection Error

Ensure PostgreSQL is running and test database exists:

```bash
psql -U devuser -h localhost -p 5433 -l
```

### Prisma Client Not Found

Generate Prisma client:

```bash
npx prisma generate
```

### Tests Timing Out

Increase timeout in jest.config.js or individual tests:

```typescript
it("slow test", async () => {
 // test code
}, 30000); // 30 second timeout
```

### Port Already in Use

Change PORT in `.env.test`:

```bash
PORT=3002
```

## More Information

See `TESTING.md` in the project root for comprehensive testing documentation.
