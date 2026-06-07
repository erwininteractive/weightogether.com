import request from "supertest";
import app from "../../src/server";
import {
	prisma,
	resetDatabase,
	createTestUser,
	createAuthenticatedUser,
} from "../helpers";
import { AuthService } from "../../src/services/auth.service";

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
					password: "Password123",
					displayName: "New User",
				dateOfBirth: "1990-01-01",
				unitSystem: "IMPERIAL",
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user).toBeDefined();
			expect(response.body.data.user.email).toBe("newuser@example.com");
			expect(response.body.data.user.username).toBe("newuser");
			expect(response.body.data.user.emailVerified).toBe(false);
			expect(response.body.message).toContain("verify your email");
		});

		it("should return 400 for missing required fields", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "newuser@example.com",
					// missing username and password
				})
				.expect(400);

			expect(response.body.success).toBe(false);
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

		it("should return 409 for duplicate email", async () => {
			await createTestUser({ email: "existing@example.com" });

			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "existing@example.com",
					username: "newuser",
					password: "Password123",
				dateOfBirth: "1990-01-01",
				unitSystem: "IMPERIAL",
				})
				.expect(409);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("Email already in use");
		});

		it("should return 409 for duplicate username", async () => {
			await createTestUser({ username: "existinguser" });

			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "new@example.com",
					username: "existinguser",
					password: "Password123",
				dateOfBirth: "1990-01-01",
				unitSystem: "IMPERIAL",
				})
				.expect(409);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("Username already taken");
		});
	});

	describe("POST /api/auth/login", () => {
		it("should login with valid credentials", async () => {
			const password = "password123";
			await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "test@example.com",
					password: password,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user).toBeDefined();
			expect(response.body.data.user.email).toBe("test@example.com");
			expect(response.body.data.tokens).toBeDefined();
			expect(response.body.data.tokens.accessToken).toBeDefined();
			expect(response.body.data.tokens.refreshToken).toBeDefined();
		});

		it("should return 401 for invalid email", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "nonexistent@example.com",
					password: "password123",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should return 401 for invalid password", async () => {
			const password = "password123";
			await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "test@example.com",
					password: "wrongpassword",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/auth/refresh", () => {
		it("should refresh tokens with valid refresh token", async () => {
			const { tokens } = await createAuthenticatedUser();

			// Wait a moment to ensure different timestamp in new token
			await new Promise((resolve) => setTimeout(resolve, 1100));

			const response = await request(app)
				.post("/api/auth/refresh")
				.send({
					refreshToken: tokens.refreshToken,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.accessToken).toBeDefined();
			expect(response.body.data.refreshToken).toBeDefined();
			// New refresh token should be different (token rotation)
			expect(response.body.data.refreshToken).not.toBe(
				tokens.refreshToken,
			);
		});

		it("should return 401 for invalid refresh token", async () => {
			const response = await request(app)
				.post("/api/auth/refresh")
				.send({
					refreshToken: "invalid-token",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should return 400 for missing refresh token", async () => {
			const response = await request(app)
				.post("/api/auth/refresh")
				.send({})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/auth/logout", () => {
		it("should logout and revoke refresh token", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/api/auth/logout")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.body.success).toBe(true);

			// Verify token is revoked
			const token = await prisma.refreshToken.findUnique({
				where: { token: tokens.refreshToken },
			});

			expect(token).toBeNull();
		});

		it("should return 200 even for non-existent token", async () => {
			const response = await request(app)
				.post("/api/auth/logout")
				.set("Cookie", [`refreshToken=non-existent-token`])
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("POST /api/auth/logout-all", () => {
		it("should logout from all devices", async () => {
			const password = "Password123";
			const user = await createTestUser({
				email: "test@example.com",
				passwordHash: await AuthService.hashPassword(password),
			});

			// Create multiple sessions with delays to get different tokens
			await AuthService.login(user.email, password);
			await new Promise((resolve) => setTimeout(resolve, 1100));
			await AuthService.login(user.email, password);
			await new Promise((resolve) => setTimeout(resolve, 1100));

			const { tokens } = await AuthService.login(user.email, password);

			const response = await request(app)
				.post("/api/auth/logout-all")
				.set("Authorization", `Bearer ${tokens.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);

			// Verify all tokens are revoked
			const remainingTokens = await prisma.refreshToken.findMany({
				where: { userId: user.id },
			});

			expect(remainingTokens.length).toBe(0);
		});

		it("should return 401 without access token", async () => {
			const response = await request(app)
				.post("/api/auth/logout-all")
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /api/auth/me", () => {
		it("should return current user with valid token", async () => {
			const { user, tokens } = await createAuthenticatedUser({
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${tokens.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(user.id);
			expect(response.body.data.email).toBe(user.email);
			expect(response.body.data.username).toBe(user.username);
		});

		it("should return 401 without token", async () => {
			const response = await request(app).get("/api/auth/me").expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should return 401 with invalid token", async () => {
			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer invalid-token")
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("Web Auth Routes", () => {
		describe("GET /login", () => {
			it("should render login page", async () => {
				const response = await request(app).get("/login").expect(200);

				expect(response.text).toContain("login");
			});

			it("should redirect to dashboard if already authenticated", async () => {
				const { tokens } = await createAuthenticatedUser();

				const response = await request(app)
					.get("/login")
					.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
					.expect(302);

				expect(response.headers.location).toBe("/dashboard");
			});
		});

		describe("GET /register", () => {
			it("should render register page", async () => {
				const response = await request(app)
					.get("/register")
					.expect(200);

				expect(response.text).toContain("register");
			});

			it("should redirect to dashboard if already authenticated", async () => {
				const { tokens } = await createAuthenticatedUser();

				const response = await request(app)
					.get("/register")
					.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
					.expect(302);

				expect(response.headers.location).toBe("/dashboard");
			});
		});

		describe("POST /register", () => {
			it("should register user and redirect to login with success message", async () => {
				const response = await request(app)
					.post("/register")
					.send({
						email: "newuser@example.com",
						username: "newuser",
						password: "Password123",
						displayName: "New User",
				dateOfBirth: "1990-01-01",
				unitSystem: "IMPERIAL",
					})
					.expect(302);

				// Web register redirects to login after successful registration
				expect(response.headers.location).toContain("/login");
				expect(response.headers.location).toContain("success=");
			});

			it("should render register page with error on validation failure", async () => {
				const response = await request(app)
					.post("/register")
					.send({
						email: "invalid-email",
						username: "newuser",
						password: "Password123",
						unitSystem: "IMPERIAL",
					})
					.expect(302); // Redirects with error toast

				// Should redirect to register page with error
				expect(response.headers.location).toContain("/register");
				expect(response.headers.location).toContain("error=");
			});
		});

		describe("POST /login", () => {
			it("should login user and redirect to dashboard", async () => {
				const password = "Password123";
				await createTestUser({
					email: "test@example.com",
					passwordHash: await AuthService.hashPassword(password),
				});

				const response = await request(app)
					.post("/login")
					.send({
						email: "test@example.com",
						password: password,
					})
					.expect(302);

				expect(response.headers.location).toContain("/dashboard");
				expect(response.headers.location).toContain("success=");
				expect(response.headers["set-cookie"]).toBeDefined();
			});

			it("should render login page with error on invalid credentials", async () => {
				const response = await request(app)
					.post("/login")
					.send({
						email: "nonexistent@example.com",
						password: "Password123",
					})
					.expect(302); // Redirects with error toast

				// Should redirect to login page with error
				expect(response.headers.location).toContain("/login");
				expect(response.headers.location).toContain("error=");
			});
		});

		describe("GET /logout", () => {
			it("should logout user and redirect to home with success message", async () => {
				const { tokens } = await createAuthenticatedUser();

				const response = await request(app)
					.get("/logout")
					.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
					.expect(302);

				// Logout redirects to home with success message
				expect(response.headers.location).toContain("/");
				expect(response.headers["set-cookie"]).toBeDefined();
			});
		});
	});
});
