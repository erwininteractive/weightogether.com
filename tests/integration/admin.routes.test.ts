import request from "supertest";
import app from "../../src/server";
import { resetDatabase, createAuthenticatedUser, prisma } from "../helpers";

describe("Admin Routes", () => {
	let adminUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;
	let regularUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;

	beforeEach(async () => {
		await resetDatabase();

		// Create an admin user
		adminUser = await createAuthenticatedUser({
			email: "admin@example.com",
			username: "adminuser",
			isAdmin: true,
		});

		// Create a regular user
		regularUser = await createAuthenticatedUser({
			email: "regular@example.com",
			username: "regularuser",
			isAdmin: false,
		});
	});

	describe("GET /admin/users", () => {
		it("should allow admin to view user list", async () => {
			const response = await request(app)
				.get("/admin/users")
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("User Management");
			expect(response.text).toContain("adminuser");
			expect(response.text).toContain("regularuser");
		});

		it("should deny access to non-admin users", async () => {
			const response = await request(app)
				.get("/admin/users")
				.set("Cookie", [
					`refreshToken=${regularUser.tokens.refreshToken}`,
					`accessToken=${regularUser.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.text).toContain("Access Denied");
		});

		it("should redirect unauthenticated users to login", async () => {
			const response = await request(app).get("/admin/users").expect(302);

			expect(response.headers.location).toContain("/login");
		});

		it("should paginate users", async () => {
			// Create more users to test pagination
			for (let i = 0; i < 5; i++) {
				await createAuthenticatedUser({
					email: `user${i}@example.com`,
					username: `user${i}`,
				});
			}

			const response = await request(app)
				.get("/admin/users?page=1")
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("User Management");
		});
	});

	describe("GET /admin/users/:userId", () => {
		it("should allow admin to view user details", async () => {
			const response = await request(app)
				.get(`/admin/users/${regularUser.user.id}`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("regularuser");
			expect(response.text).toContain("regular@example.com");
		});

		it("should return 404 for non-existent user", async () => {
			const response = await request(app)
				.get("/admin/users/00000000-0000-0000-0000-000000000000")
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.expect(404);

			expect(response.text).toContain("User Not Found");
		});

		it("should deny access to non-admin users", async () => {
			await request(app)
				.get(`/admin/users/${adminUser.user.id}`)
				.set("Cookie", [
					`refreshToken=${regularUser.tokens.refreshToken}`,
					`accessToken=${regularUser.tokens.accessToken}`,
				])
				.expect(403);
		});
	});

	describe("POST /admin/users/:userId/reset-password", () => {
		it("should allow admin to reset user password", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/reset-password`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({ newPassword: "NewPassword123" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.message).toContain(
				"Password reset successfully",
			);
		});

		it("should reject weak passwords", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/reset-password`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({ newPassword: "weak" })
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.errors).toBeDefined();
		});

		it("should return 404 for non-existent user", async () => {
			const response = await request(app)
				.post(
					"/admin/users/00000000-0000-0000-0000-000000000000/reset-password",
				)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({ newPassword: "NewPassword123" })
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it("should invalidate refresh tokens after password reset", async () => {
			await request(app)
				.post(`/admin/users/${regularUser.user.id}/reset-password`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({ newPassword: "NewPassword123" })
				.expect(200);

			const tokens = await prisma.refreshToken.findMany({
				where: { userId: regularUser.user.id },
			});

			expect(tokens).toHaveLength(0);
		});
	});

	describe("POST /admin/users/:userId/toggle-admin", () => {
		it("should allow admin to grant admin status", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/toggle-admin`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.isAdmin).toBe(true);

			const updatedUser = await prisma.user.findUnique({
				where: { id: regularUser.user.id },
			});
			expect(updatedUser?.isAdmin).toBe(true);
		});

		it("should allow admin to revoke admin status", async () => {
			// First make the regular user an admin
			await prisma.user.update({
				where: { id: regularUser.user.id },
				data: { isAdmin: true },
			});

			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/toggle-admin`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.isAdmin).toBe(false);
		});

		it("should prevent admin from modifying their own admin status", async () => {
			const response = await request(app)
				.post(`/admin/users/${adminUser.user.id}/toggle-admin`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("cannot modify your own");
		});
	});

	describe("POST /admin/users/:userId/toggle-active", () => {
		it("should allow admin to deactivate user", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/toggle-active`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.isActive).toBe(false);

			const updatedUser = await prisma.user.findUnique({
				where: { id: regularUser.user.id },
			});
			expect(updatedUser?.isActive).toBe(false);
		});

		it("should allow admin to reactivate user", async () => {
			// First deactivate the user
			await prisma.user.update({
				where: { id: regularUser.user.id },
				data: { isActive: false },
			});

			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/toggle-active`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.isActive).toBe(true);
		});

		it("should prevent admin from deactivating themselves", async () => {
			const response = await request(app)
				.post(`/admin/users/${adminUser.user.id}/toggle-active`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain(
				"cannot deactivate your own",
			);
		});

		it("should invalidate refresh tokens when deactivating user", async () => {
			await request(app)
				.post(`/admin/users/${regularUser.user.id}/toggle-active`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			const tokens = await prisma.refreshToken.findMany({
				where: { userId: regularUser.user.id },
			});

			expect(tokens).toHaveLength(0);
		});
	});

	describe("POST /admin/users/:userId/delete", () => {
		it("should allow admin to delete a non-admin user", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/delete`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.message).toContain("permanently deleted");

			const deletedUser = await prisma.user.findUnique({
				where: { id: regularUser.user.id },
			});
			expect(deletedUser).toBeNull();
		});

		it("should prevent admin from deleting themselves", async () => {
			const response = await request(app)
				.post(`/admin/users/${adminUser.user.id}/delete`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("cannot delete your own");
		});

		it("should prevent deleting another admin user", async () => {
			// Create another admin
			const anotherAdmin = await createAuthenticatedUser({
				email: "admin2@example.com",
				username: "admin2",
				isAdmin: true,
			});

			const response = await request(app)
				.post(`/admin/users/${anotherAdmin.user.id}/delete`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain(
				"Cannot delete an admin user",
			);
		});

		it("should return 404 for non-existent user", async () => {
			const response = await request(app)
				.post(
					"/admin/users/00000000-0000-0000-0000-000000000000/delete",
				)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it("should cascade delete user's related data", async () => {
			// Create some related data for the user
			await prisma.weightEntry.create({
				data: {
					userId: regularUser.user.id,
					weight: 180,
					recordedAt: new Date(),
				},
			});

			await request(app)
				.post(`/admin/users/${regularUser.user.id}/delete`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			// Verify related data is also deleted
			const entries = await prisma.weightEntry.findMany({
				where: { userId: regularUser.user.id },
			});
			expect(entries).toHaveLength(0);
		});
	});

	describe("POST /admin/users/:userId/resend-verification", () => {
		it("should resend verification email for unverified user", async () => {
			// Create an unverified user
			const unverifiedUser = await createAuthenticatedUser({
				email: "unverified@example.com",
				username: "unverified",
				emailVerified: false,
			});

			const response = await request(app)
				.post(
					`/admin/users/${unverifiedUser.user.id}/resend-verification`,
				)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.message).toContain("Verification email sent");
		});

		it("should reject if user is already verified", async () => {
			const response = await request(app)
				.post(`/admin/users/${regularUser.user.id}/resend-verification`)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("already verified");
		});

		it("should return 404 for non-existent user", async () => {
			const response = await request(app)
				.post(
					"/admin/users/00000000-0000-0000-0000-000000000000/resend-verification",
				)
				.set("Cookie", [
					`refreshToken=${adminUser.tokens.refreshToken}`,
					`accessToken=${adminUser.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});
});
