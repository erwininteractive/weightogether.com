import request from "supertest";
import app from "../../src/server";
import {
	prisma,
	resetDatabase,
	createAuthenticatedUser,
	createTestWeightEntry,
} from "../helpers";

describe("Weight Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("GET /progress", () => {
		it("should render weight progress page for authenticated user", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/progress")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Weight Progress");
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app).get("/progress").expect(302);

			expect(response.headers.location).toContain("/login");
		});

		it("should display weight entries", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await createTestWeightEntry(user.id, {
				weight: 180,
				notes: "Test entry",
			});

			const response = await request(app)
				.get("/progress")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("180");
			expect(response.text).toContain("Test entry");
		});

		it("should calculate stats correctly", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			// Create multiple entries
			await createTestWeightEntry(user.id, {
				weight: 200,
				recordedAt: new Date("2024-01-01"),
			});
			await createTestWeightEntry(user.id, {
				weight: 190,
				recordedAt: new Date("2024-01-15"),
			});
			await createTestWeightEntry(user.id, {
				weight: 185,
				recordedAt: new Date("2024-02-01"),
			});

			const response = await request(app)
				.get("/progress")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			// Should show total change (start 200, current 185 = -15)
			expect(response.text).toContain("185");
			expect(response.text).toContain("200");
		});
	});

	describe("GET /progress/log", () => {
		it("should render log form for authenticated user", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Log Weight");
		});

		it("should render edit form when edit param provided", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const response = await request(app)
				.get(`/progress/log?edit=${entry.id}`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Edit Weight Entry");
			expect(response.text).toContain("180");
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app)
				.get("/progress/log")
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});

	describe("POST /progress/log", () => {
		it("should create new weight entry", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					weight: "180.5",
					recordedAt: "2024-01-01",
					notes: "First entry",
					visibility: "PRIVATE",
				})
				.expect(302);

			expect(response.headers.location).toContain("/progress");
			expect(response.headers.location).toContain("success=");

			const entry = await prisma.weightEntry.findFirst({
				where: { userId: user.id },
			});

			expect(entry).toBeDefined();
			expect(entry?.weight).toBe(180.5);
			expect(entry?.notes).toBe("First entry");
		});

		it("should update existing weight entry", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const response = await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					entryId: entry.id,
					weight: "175",
					recordedAt: entry.recordedAt.toISOString().split("T")[0],
					notes: "Updated entry",
					visibility: "PRIVATE",
				})
				.expect(302);

			expect(response.headers.location).toContain("/progress");
			expect(response.headers.location).toContain("success=");

			const updatedEntry = await prisma.weightEntry.findUnique({
				where: { id: entry.id },
			});

			expect(updatedEntry?.weight).toBe(175);
			expect(updatedEntry?.notes).toBe("Updated entry");
		});

		it("should update user's current weight", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					weight: "180",
					recordedAt: new Date().toISOString().split("T")[0],
					visibility: "PRIVATE",
				})
				.expect(302);

			const updatedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			expect(updatedUser?.currentWeight).toBe(180);
		});

		it("should validate weight input", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					weight: "-10", // Invalid weight
					recordedAt: "2024-01-01",
					visibility: "PRIVATE",
				})
				.expect(200);

			expect(response.text).toContain("Weight must be between");
		});

		it("should validate recordedAt date", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					weight: "180",
					recordedAt: "invalid-date",
					visibility: "PRIVATE",
				})
				.expect(200);

			expect(response.text).toContain("Invalid date");
		});

		it("should accept optional body composition metrics", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await request(app)
				.post("/progress/log")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					weight: "180",
					recordedAt: "2024-01-01",
					bodyFatPercentage: "18.5",
					muscleMass: "145",
					waterPercentage: "60",
					visibility: "PRIVATE",
				})
				.expect(302);

			const entry = await prisma.weightEntry.findFirst({
				where: { userId: user.id },
			});

			expect(entry?.bodyFatPercentage).toBe(18.5);
			expect(entry?.muscleMass).toBe(145);
			expect(entry?.waterPercentage).toBe(60);
		});
	});

	describe("POST /progress/delete/:id", () => {
		it("should delete weight entry", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const response = await request(app)
				.post(`/progress/delete/${entry.id}`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/progress");
			expect(response.headers.location).toContain("success=");

			const deletedEntry = await prisma.weightEntry.findUnique({
				where: { id: entry.id },
			});

			expect(deletedEntry).toBeNull();
		});

		it("should update user's current weight after deletion", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await createTestWeightEntry(user.id, {
				weight: 200,
				recordedAt: new Date("2024-01-01"),
			});
			const entry2 = await createTestWeightEntry(user.id, {
				weight: 190,
				recordedAt: new Date("2024-01-15"),
			});

			// Delete the most recent entry
			await request(app)
				.post(`/progress/delete/${entry2.id}`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			const updatedUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			// Current weight should now be from entry1
			expect(updatedUser?.currentWeight).toBe(200);
		});

		it("should not allow deleting another user's entry", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const entry = await createTestWeightEntry(user2.id, {
				weight: 180,
			});

			const response = await request(app)
				.post(`/progress/delete/${entry.id}`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("error=");

			// Entry should still exist
			const stillExists = await prisma.weightEntry.findUnique({
				where: { id: entry.id },
			});

			expect(stillExists).toBeDefined();
		});

		it("should redirect to login if not authenticated", async () => {
			const { user } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const response = await request(app)
				.post(`/progress/delete/${entry.id}`)
				.expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});

	describe("POST /progress/photo/:photoId/visibility", () => {
		it("should update photo visibility", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const photo = await prisma.progressPhoto.create({
				data: {
					entryId: entry.id,
					url: "/uploads/test.jpg",
					visibility: "PRIVATE",
					sortOrder: 0,
				},
			});

			const response = await request(app)
				.post(`/progress/photo/${photo.id}/visibility`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({ visibility: "PUBLIC" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.visibility).toBe("PUBLIC");

			const updatedPhoto = await prisma.progressPhoto.findUnique({
				where: { id: photo.id },
			});

			expect(updatedPhoto?.visibility).toBe("PUBLIC");
		});

		it("should not allow updating another user's photo", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const entry = await createTestWeightEntry(user2.id, {
				weight: 180,
			});

			const photo = await prisma.progressPhoto.create({
				data: {
					entryId: entry.id,
					url: "/uploads/test.jpg",
					visibility: "PRIVATE",
					sortOrder: 0,
				},
			});

			const response = await request(app)
				.post(`/progress/photo/${photo.id}/visibility`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.send({ visibility: "PUBLIC" })
				.expect(404);

			expect(response.body.error).toBeDefined();
		});

		it("should validate visibility value", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const photo = await prisma.progressPhoto.create({
				data: {
					entryId: entry.id,
					url: "/uploads/test.jpg",
					visibility: "PRIVATE",
					sortOrder: 0,
				},
			});

			const response = await request(app)
				.post(`/progress/photo/${photo.id}/visibility`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({ visibility: "INVALID" })
				.expect(400);

			expect(response.body.error).toContain("Invalid visibility");
		});
	});

	describe("DELETE /photo/:photoId", () => {
		it("should delete photo", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const entry = await createTestWeightEntry(user.id, {
				weight: 180,
			});

			const photo = await prisma.progressPhoto.create({
				data: {
					entryId: entry.id,
					url: "/uploads/test.jpg",
					visibility: "PRIVATE",
					sortOrder: 0,
				},
			});

			const response = await request(app)
				.delete(`/photo/${photo.id}`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.body.success).toBe(true);

			const deletedPhoto = await prisma.progressPhoto.findUnique({
				where: { id: photo.id },
			});

			expect(deletedPhoto).toBeNull();
		});

		it("should not allow deleting another user's photo", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const entry = await createTestWeightEntry(user2.id, {
				weight: 180,
			});

			const photo = await prisma.progressPhoto.create({
				data: {
					entryId: entry.id,
					url: "/uploads/test.jpg",
					visibility: "PRIVATE",
					sortOrder: 0,
				},
			});

			const response = await request(app)
				.delete(`/photo/${photo.id}`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(404);

			expect(response.body.error).toBeDefined();

			// Photo should still exist
			const stillExists = await prisma.progressPhoto.findUnique({
				where: { id: photo.id },
			});

			expect(stillExists).toBeDefined();
		});
	});
});
