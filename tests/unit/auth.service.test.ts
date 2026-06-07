import { AuthService } from "../../src/services/auth.service";
import { prisma, resetDatabase, createTestUser } from "../helpers";
import { UnitSystem } from "@prisma/client";

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
			expect(hash.length).toBeGreaterThan(0);
		});

		it("should generate different hashes for the same password", async () => {
			const password = "mySecurePassword123";
			const hash1 = await AuthService.hashPassword(password);
			const hash2 = await AuthService.hashPassword(password);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe("comparePassword", () => {
		it("should return true for matching password and hash", async () => {
			const password = "mySecurePassword123";
			const hash = await AuthService.hashPassword(password);

			const result = await AuthService.comparePassword(password, hash);
			expect(result).toBe(true);
		});

		it("should return false for non-matching password and hash", async () => {
			const password = "mySecurePassword123";
			const wrongPassword = "wrongPassword";
			const hash = await AuthService.hashPassword(password);

			const result = await AuthService.comparePassword(wrongPassword, hash);
			expect(result).toBe(false);
		});
	});

	describe("generateAccessToken", () => {
		it("should generate a valid access token", () => {
			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateAccessToken(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe("string");
			expect(token.split(".").length).toBe(3); // JWT has 3 parts
		});
	});

	describe("generateRefreshToken", () => {
		it("should generate a valid refresh token", () => {
			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateRefreshToken(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe("string");
			expect(token.split(".").length).toBe(3);
		});
	});

	describe("verifyAccessToken", () => {
		it("should verify a valid access token", () => {
			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateAccessToken(payload);
			const decoded = AuthService.verifyAccessToken(token);

			expect(decoded.sub).toBe(payload.sub);
			expect(decoded.email).toBe(payload.email);
			expect(decoded.username).toBe(payload.username);
		});

		it("should throw error for invalid token", () => {
			expect(() => {
				AuthService.verifyAccessToken("invalid-token");
			}).toThrow();
		});
	});

	describe("verifyRefreshToken", () => {
		it("should verify a valid refresh token", () => {
			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateRefreshToken(payload);
			const decoded = AuthService.verifyRefreshToken(token);

			expect(decoded.sub).toBe(payload.sub);
			expect(decoded.email).toBe(payload.email);
		});

		it("should throw error for invalid token", () => {
			expect(() => {
				AuthService.verifyRefreshToken("invalid-token");
			}).toThrow();
		});
	});

	describe("register", () => {
		it("should register a new user", async () => {
			const input = {
				email: "newuser@example.com",
				username: "newuser",
				password: "password123",
				displayName: "New User",
				unitSystem: UnitSystem.IMPERIAL,
			};

			const user = await AuthService.register(input);

			expect(user).toBeDefined();
			expect(user.email).toBe(input.email);
			expect(user.username).toBe(input.username);
			expect(user.displayName).toBe(input.displayName);
			expect("passwordHash" in user).toBe(false); // Should not include password hash
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

		it("should throw error if username already exists", async () => {
			await createTestUser({ username: "existinguser" });

			const input = {
				email: "new@example.com",
				username: "existinguser",
				password: "password123",
			};

			await expect(AuthService.register(input)).rejects.toThrow(
				"Username already taken",
			);
		});

		it("should use username as displayName if not provided", async () => {
			const input = {
				email: "newuser@example.com",
				username: "newuser",
				password: "password123",
			};

			const user = await AuthService.register(input);

			expect(user.displayName).toBe("newuser");
		});
	});

	describe("login", () => {
		it("should login a user with valid credentials", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const result = await AuthService.login(user.email, password);

			expect(result.user).toBeDefined();
			expect(result.user.email).toBe(user.email);
			expect(result.tokens).toBeDefined();
			expect(result.tokens.accessToken).toBeDefined();
			expect(result.tokens.refreshToken).toBeDefined();
		});

		it("should store refresh token in database", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const result = await AuthService.login(user.email, password);

			const storedToken = await prisma.refreshToken.findUnique({
				where: { token: result.tokens.refreshToken },
			});

			expect(storedToken).toBeDefined();
			expect(storedToken?.userId).toBe(user.id);
		});

		it("should throw error for invalid email", async () => {
			await expect(
				AuthService.login("nonexistent@example.com", "password123"),
			).rejects.toThrow("Invalid email or password");
		});

		it("should throw error for invalid password", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			await expect(
				AuthService.login(user.email, "wrongpassword"),
			).rejects.toThrow("Invalid email or password");
		});

		it("should throw error for inactive account", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
				isActive: false,
			});

			await expect(
				AuthService.login(user.email, password),
			).rejects.toThrow("Account is deactivated");
		});
	});

	describe("refreshTokens", () => {
		it("should refresh tokens with valid refresh token", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const loginResult = await AuthService.login(user.email, password);
			const oldRefreshToken = loginResult.tokens.refreshToken;

			// Wait 1 second to ensure different JWT timestamp
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const newTokens = await AuthService.refreshTokens(oldRefreshToken);

			expect(newTokens.accessToken).toBeDefined();
			expect(newTokens.refreshToken).toBeDefined();
			expect(newTokens.refreshToken).not.toBe(oldRefreshToken);
		});

		it("should rotate refresh tokens (delete old, create new)", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const loginResult = await AuthService.login(user.email, password);
			const oldRefreshToken = loginResult.tokens.refreshToken;

			// Wait 1 second to ensure different JWT timestamp
			await new Promise((resolve) => setTimeout(resolve, 1000));

			await AuthService.refreshTokens(oldRefreshToken);

			const oldToken = await prisma.refreshToken.findUnique({
				where: { token: oldRefreshToken },
			});

			expect(oldToken).toBeNull();
		});

		it("should throw error for invalid refresh token", async () => {
			await expect(
				AuthService.refreshTokens("invalid-token"),
			).rejects.toThrow("Invalid refresh token");
		});

		it("should throw error for expired refresh token", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const payload = await AuthService.buildJwtPayload(user.id);
			const refreshToken = AuthService.generateRefreshToken(payload);

			// Create expired token in database
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

			await prisma.refreshToken.create({
				data: {
					token: refreshToken,
					userId: user.id,
					expiresAt: expiredDate,
				},
			});

			await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow(
				"Refresh token expired",
			);
		});
	});

	describe("logout", () => {
		it("should revoke refresh token", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const loginResult = await AuthService.login(user.email, password);
			await AuthService.logout(loginResult.tokens.refreshToken);

			const token = await prisma.refreshToken.findUnique({
				where: { token: loginResult.tokens.refreshToken },
			});

			expect(token).toBeNull();
		});
	});

	describe("logoutAll", () => {
		it("should revoke all refresh tokens for a user", async () => {
			const password = "password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			// Create multiple sessions
			await AuthService.login(user.email, password);

			// Wait 1 second to ensure different JWT timestamp
			await new Promise((resolve) => setTimeout(resolve, 1000));

			await AuthService.login(user.email, password);

			await AuthService.logoutAll(user.id);

			const tokens = await prisma.refreshToken.findMany({
				where: { userId: user.id },
			});

			expect(tokens.length).toBe(0);
		});
	});

	describe("getUserById", () => {
		it("should return user without password hash", async () => {
			const user = await createTestUser();

			const result = await AuthService.getUserById(user.id);

			expect(result).toBeDefined();
			expect(result?.id).toBe(user.id);
			expect("passwordHash" in result!).toBe(false);
		});

		it("should return null for non-existent user", async () => {
			const result = await AuthService.getUserById("non-existent-id");

			expect(result).toBeNull();
		});
	});

	describe("cleanupExpiredTokens", () => {
		it("should delete expired tokens", async () => {
			const user = await createTestUser();

			// Create expired token
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 1);

			await prisma.refreshToken.create({
				data: {
					token: "expired-token",
					userId: user.id,
					expiresAt: expiredDate,
				},
			});

			// Create valid token
			const validDate = new Date();
			validDate.setDate(validDate.getDate() + 7);

			await prisma.refreshToken.create({
				data: {
					token: "valid-token",
					userId: user.id,
					expiresAt: validDate,
				},
			});

			const count = await AuthService.cleanupExpiredTokens();

			expect(count).toBe(1);

			const tokens = await prisma.refreshToken.findMany({
				where: { userId: user.id },
			});

			expect(tokens.length).toBe(1);
			expect(tokens[0].token).toBe("valid-token");
		});
	});
});
