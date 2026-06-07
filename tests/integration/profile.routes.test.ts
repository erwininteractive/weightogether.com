import request from "supertest";
import app from "../../src/server";
import {
	prisma,
	resetDatabase,
	createAuthenticatedUser,
} from "../helpers";
import { UnitSystem, Gender, ActivityLevel } from "@prisma/client";

describe("Profile Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("GET /profile/edit", () => {
		it("should render edit profile page for authenticated user", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Edit Profile");
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app)
				.get("/profile/edit")
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});

		it("should display current user information", async () => {
			const { tokens } = await createAuthenticatedUser({
				displayName: "Test User",
				bio: "Test bio",
			});

			const response = await request(app)
				.get("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Test User");
			expect(response.text).toContain("Test bio");
		});
	});

	describe("POST /profile/edit", () => {
		it("should update profile information", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					displayName: "Updated Name",
					bio: "Updated bio",
					unitSystem: "METRIC",
					currentWeight: "80",
					goalWeight: "75",
					height: "180",
					gender: "MALE",
					activityLevel: "MODERATELY_ACTIVE",
					profilePublic: "true",
					weightVisible: "true",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");

			

			const updatedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			expect(updatedUser?.displayName).toBe("Updated Name");
			expect(updatedUser?.bio).toBe("Updated bio");
			expect(updatedUser?.unitSystem).toBe(UnitSystem.METRIC);
			expect(updatedUser?.currentWeight).toBe(80);
			expect(updatedUser?.goalWeight).toBe(75);
			expect(updatedUser?.height).toBe(180);
			expect(updatedUser?.gender).toBe(Gender.MALE);
			expect(updatedUser?.activityLevel).toBe(
				ActivityLevel.MODERATELY_ACTIVE,
			);
			expect(updatedUser?.profilePublic).toBe(true);
			expect(updatedUser?.weightVisible).toBe(true);
		});

		it("should allow clearing optional fields", async () => {
			const { user, tokens } = await createAuthenticatedUser({
				displayName: "Test User",
				bio: "Test bio",
			});

			await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					displayName: "",
					bio: "",
					unitSystem: "IMPERIAL",
					profilePublic: "false",
					weightVisible: "false",
				})
				.expect(302);

			const updatedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			expect(updatedUser?.displayName).toBeNull();
			expect(updatedUser?.bio).toBeNull();
		});

		it("should validate display name length", async () => {
			const { tokens } = await createAuthenticatedUser();

			const longName = "a".repeat(101); // Too long

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					displayName: longName,
					unitSystem: "IMPERIAL",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate bio length", async () => {
			const { tokens } = await createAuthenticatedUser();

			const longBio = "a".repeat(501); // Too long

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					bio: longBio,
					unitSystem: "IMPERIAL",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate unit system", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "INVALID",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate current weight range", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					currentWeight: "1001", // Too high
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate goal weight range", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					goalWeight: "-10", // Negative
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate height range", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					height: "301", // Too high
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate gender value", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					gender: "INVALID",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate activity level value", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					activityLevel: "INVALID",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate date of birth format", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					dateOfBirth: "invalid-date",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should validate target date format", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					targetDate: "invalid-date",
				})
				.expect(302);

			expect(response.headers.location).toContain("/profile/edit");
			expect(response.headers.location).toContain("error=");
		});

		it("should accept valid dates", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await request(app)
				.post("/profile/edit")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					unitSystem: "IMPERIAL",
					dateOfBirth: "1990-01-01",
					targetDate: "2025-12-31",
				})
				.expect(302);

			const updatedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			expect(updatedUser?.dateOfBirth).toBeDefined();
			expect(updatedUser?.targetDate).toBeDefined();
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app)
				.post("/profile/edit")
				.send({
					displayName: "Test",
					unitSystem: "IMPERIAL",
				})
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});
});
