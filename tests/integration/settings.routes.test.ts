import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../src/server";
import { resetDatabase, createAuthenticatedUser, prisma } from "../helpers";

describe("Settings Routes", () => {
	let authenticatedUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;

	beforeEach(async () => {
		await resetDatabase();
		authenticatedUser = await createAuthenticatedUser({
			email: "settings@example.com",
			username: "settingsuser",
		});
	});

	describe("GET /settings", () => {
		it("should render settings page for authenticated user", async () => {
			const response = await request(app)
				.get("/settings")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Settings");
		});

		it("should redirect unauthenticated user to login", async () => {
			const response = await request(app).get("/settings").expect(302);

			expect(response.headers.location).toContain("/login");
		});

		it("should display success message from query param", async () => {
			const response = await request(app)
				.get("/settings?success=Test+success+message")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Test success message");
		});

		it("should display error message from query param", async () => {
			const response = await request(app)
				.get("/settings?error=Test+error+message")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Test error message");
		});
	});

	describe("POST /settings/preferences", () => {
		it("should update user preferences with checkbox values", async () => {
			const response = await request(app)
				.post("/settings/preferences")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					unitSystem: "METRIC",
					profilePublic: "on", // How HTML checkboxes actually send values
					weightVisible: "on",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("success=");

			const updatedUser = await prisma.user.findUnique({
				where: { id: authenticatedUser.user.id },
			});

			expect(updatedUser?.unitSystem).toBe("METRIC");
			expect(updatedUser?.profilePublic).toBe(true);
			expect(updatedUser?.weightVisible).toBe(true);
		});

		it("should handle unchecked checkboxes (false values)", async () => {
			// First set values to true
			await prisma.user.update({
				where: { id: authenticatedUser.user.id },
				data: { profilePublic: true, weightVisible: true },
			});

			await request(app)
				.post("/settings/preferences")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					unitSystem: "IMPERIAL",
					// profilePublic and weightVisible not sent (unchecked)
				})
				.expect(302);

			const updatedUser = await prisma.user.findUnique({
				where: { id: authenticatedUser.user.id },
			});

			expect(updatedUser?.profilePublic).toBe(false);
			expect(updatedUser?.weightVisible).toBe(false);
		});

		it("should validate unit system", async () => {
			const response = await request(app)
				.post("/settings/preferences")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					unitSystem: "INVALID",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("error=");
		});

		it("should redirect unauthenticated user to login", async () => {
			const response = await request(app)
				.post("/settings/preferences")
				.send({
					unitSystem: "METRIC",
				})
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});

	describe("POST /settings/password", () => {
		it("should change password with valid current password", async () => {
			const response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "password123",
					newPassword: "NewPassword123",
					confirmPassword: "NewPassword123",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("success=");

			// Verify password was changed
			const updatedUser = await prisma.user.findUnique({
				where: { id: authenticatedUser.user.id },
			});

			const isNewPasswordValid = await bcrypt.compare(
				"NewPassword123",
				updatedUser!.passwordHash,
			);
			expect(isNewPasswordValid).toBe(true);
		});

		it("should reject incorrect current password", async () => {
			const response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "wrongpassword",
					newPassword: "NewPassword123",
					confirmPassword: "NewPassword123",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("error=");
			expect(response.headers.location).toContain("incorrect");
		});

		it("should reject password that does not meet requirements", async () => {
			const response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "password123",
					newPassword: "weak",
					confirmPassword: "weak",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("error=");
		});

		it("should reject mismatched passwords", async () => {
			const response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "password123",
					newPassword: "NewPassword123",
					confirmPassword: "DifferentPassword123",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("error=");
		});

		it("should require uppercase, lowercase, and number in new password", async () => {
			// All lowercase
			let response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "password123",
					newPassword: "alllowercase",
					confirmPassword: "alllowercase",
				})
				.expect(302);

			expect(response.headers.location).toContain("error=");

			// No numbers
			response = await request(app)
				.post("/settings/password")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					currentPassword: "password123",
					newPassword: "NoNumbersHere",
					confirmPassword: "NoNumbersHere",
				})
				.expect(302);

			expect(response.headers.location).toContain("error=");
		});

		it("should redirect unauthenticated user to login", async () => {
			const response = await request(app)
				.post("/settings/password")
				.send({
					currentPassword: "password123",
					newPassword: "NewPassword123",
					confirmPassword: "NewPassword123",
				})
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});

	describe("POST /settings/delete-account", () => {
		it("should delete account with correct password", async () => {
			const userId = authenticatedUser.user.id;

			const response = await request(app)
				.post("/settings/delete-account")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					confirmPassword: "password123",
				})
				.expect(302);

			expect(response.headers.location).toContain("message=");
			expect(response.headers.location).toContain("deleted");

			// Verify user was deleted
			const deletedUser = await prisma.user.findUnique({
				where: { id: userId },
			});
			expect(deletedUser).toBeNull();
		});

		it("should reject incorrect password", async () => {
			const response = await request(app)
				.post("/settings/delete-account")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					confirmPassword: "wrongpassword",
				})
				.expect(302);

			expect(response.headers.location).toContain("/settings");
			expect(response.headers.location).toContain("error=");
			expect(response.headers.location).toContain("Incorrect");

			// Verify user was NOT deleted
			const user = await prisma.user.findUnique({
				where: { id: authenticatedUser.user.id },
			});
			expect(user).not.toBeNull();
		});

		it("should cascade delete related data", async () => {
			// Create related data
			await prisma.weightEntry.create({
				data: {
					userId: authenticatedUser.user.id,
					weight: 180,
					recordedAt: new Date(),
				},
			});

			await request(app)
				.post("/settings/delete-account")
				.set("Cookie", [
					`refreshToken=${authenticatedUser.tokens.refreshToken}`,
					`accessToken=${authenticatedUser.tokens.accessToken}`,
				])
				.send({
					confirmPassword: "password123",
				})
				.expect(302);

			// Verify related data was deleted
			const entries = await prisma.weightEntry.findMany({
				where: { userId: authenticatedUser.user.id },
			});
			expect(entries).toHaveLength(0);
		});

		it("should redirect unauthenticated user to login", async () => {
			const response = await request(app)
				.post("/settings/delete-account")
				.send({
					confirmPassword: "password123",
				})
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});
});
