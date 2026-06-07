import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../src/server";
import { resetDatabase } from "../helpers/db";
import {
	createAuthenticatedUser,
	createTestAchievement,
	createTestUserAchievement,
	createTestUser,
	createTestWeightEntry,
} from "../helpers/factories";
import { prisma } from "../helpers/db";

describe("Achievement Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("GET /achievements", () => {
		it("should redirect to login if not authenticated", async () => {
			const response = await request(app).get("/achievements");

			expect(response.status).toBe(302);
			expect(response.headers.location).toContain("/login");
		});

		it("should display user achievements page when authenticated", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const achievement = await createTestAchievement({
				name: "Test Achievement",
			});
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("My Achievements");
			expect(response.text).toContain("Test Achievement");
		});

		it("should show unlocked and locked achievements", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const achievement1 = await createTestAchievement({ name: "Unlocked" });
			await createTestAchievement({ name: "Locked" });

			await createTestUserAchievement(user.id, achievement1.id);

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Unlocked");
			expect(response.text).toContain("Locked");
			expect(response.text).toContain("In Progress");
		});

		it("should display total points", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const achievement1 = await createTestAchievement({
				name: "Achievement 1",
				points: 50,
			});
			const achievement2 = await createTestAchievement({
				name: "Achievement 2",
				points: 100,
			});

			await createTestUserAchievement(user.id, achievement1.id);
			await createTestUserAchievement(user.id, achievement2.id);

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("150"); // Total points
		});

		it("should show empty state for new users", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("No Achievements Yet");
		});
	});

	describe("GET /achievements/user/:userId", () => {
		it("should redirect to login if not authenticated", async () => {
			const user = await createTestUser();

			const response = await request(app).get(
				`/achievements/user/${user.id}`,
			);

			expect(response.status).toBe(302);
			expect(response.headers.location).toContain("/login");
		});

		it("should display user achievements for public profile", async () => {
			const { tokens } = await createAuthenticatedUser();
			const publicUser = await createTestUser({ profilePublic: true });
			const achievement = await createTestAchievement({
				name: "Public Achievement",
			});
			await createTestUserAchievement(publicUser.id, achievement.id);

			const response = await request(app)
				.get(`/achievements/user/${publicUser.id}`)
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Public Achievement");
		});

		it("should return 403 for private profile", async () => {
			const { tokens } = await createAuthenticatedUser();
			const privateUser = await createTestUser({ profilePublic: false });

			const response = await request(app)
				.get(`/achievements/user/${privateUser.id}`)
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(403);
			expect(response.text).toContain("Private Profile");
		});

		it("should show own achievements even if profile is private", async () => {
			const { user, tokens } = await createAuthenticatedUser({
				profilePublic: false,
			});
			const achievement = await createTestAchievement({
				name: "My Achievement",
			});
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.get(`/achievements/user/${user.id}`)
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("My Achievement");
		});

		it("should return 404 for non-existent user", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/achievements/user/non-existent-id")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(404);
		});
	});

	describe("GET /achievements/api", () => {
		it("should return 401 if not authenticated", async () => {
			const response = await request(app).get("/achievements/api");

			expect(response.status).toBe(401);
		});

		it("should return user achievements as JSON", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const achievement = await createTestAchievement({
				name: "API Achievement",
				points: 50,
			});
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.get("/achievements/api")
				.set("Authorization", `Bearer ${tokens.accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.unlocked).toHaveLength(1);
			expect(response.body.data.unlocked[0].name).toBe("API Achievement");
			expect(response.body.data.totalPoints).toBe(50);
		});

		it("should return locked achievements with progress", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "5 lbs Lost" });

			// Create entries showing 3 lbs lost
			await createTestWeightEntry(user.id, { weight: 200 });
			await createTestWeightEntry(user.id, { weight: 197 });

			await prisma.user.update({
				where: { id: user.id },
				data: { currentWeight: 197 },
			});

			const response = await request(app)
				.get("/achievements/api")
				.set("Authorization", `Bearer ${tokens.accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.data.locked).toHaveLength(1);
			expect(response.body.data.locked[0].achievement.name).toBe("5 lbs Lost");
			expect(response.body.data.locked[0].current).toBe(3);
			expect(response.body.data.locked[0].target).toBe(5);
			expect(response.body.data.locked[0].progress).toBe(60);
		});
	});

	describe("POST /achievements/api/check", () => {
		it("should return 401 if not authenticated", async () => {
			const response = await request(app).post("/achievements/api/check");

			expect(response.status).toBe(401);
		});

		it("should check all achievement types and return newly unlocked", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "First Weigh-In" });

			// Create weight entry
			await createTestWeightEntry(user.id, { weight: 200 });

			const response = await request(app)
				.post("/achievements/api/check")
				.set("Authorization", `Bearer ${tokens.accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.unlocked).toHaveLength(1);
			expect(response.body.unlocked[0].name).toBe("First Weigh-In");
		});

		it("should not unlock already unlocked achievements", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const achievement = await createTestAchievement({
				name: "Already Unlocked",
			});

			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.post("/achievements/api/check")
				.set("Authorization", `Bearer ${tokens.accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.unlocked).toHaveLength(0);
			expect(response.body.message).toContain("Unlocked 0 new achievements");
		});

		it("should unlock multiple achievements at once", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "5 lbs Lost" });
			await createTestAchievement({ name: "10 lbs Lost" });
			await createTestAchievement({ name: "25 lbs Lost" });

			// Create entries showing 26 lbs lost
			const now = new Date();
			await createTestWeightEntry(user.id, {
				weight: 200,
				recordedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
			});
			await createTestWeightEntry(user.id, {
				weight: 174,
				recordedAt: now,
			});

			// Update user's current weight
			await prisma.user.update({
				where: { id: user.id },
				data: { currentWeight: 174 },
			});

			const response = await request(app)
				.post("/achievements/api/check")
				.set("Authorization", `Bearer ${tokens.accessToken}`);

			expect(response.status).toBe(200);

			const achievementNames = response.body.unlocked.map(
				(a: { name: string }) => a.name,
			);
			expect(achievementNames).toContain("5 lbs Lost");
			expect(achievementNames).toContain("10 lbs Lost");
			expect(achievementNames).toContain("25 lbs Lost");
			expect(response.body.unlocked.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("GET /achievements/leaderboard", () => {
		it("should display leaderboard without authentication", async () => {
			const user = await createTestUser({ profilePublic: true });
			const achievement = await createTestAchievement({
				name: "Leaderboard Test",
				points: 100,
			});
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app).get("/achievements/leaderboard");

			expect(response.status).toBe(200);
			expect(response.text).toContain("Achievement Leaderboard");
			expect(response.text).toContain("100"); // Points
		});

		it("should rank users by total points", async () => {
			const user1 = await createTestUser({
				profilePublic: true,
				displayName: "First Place",
			});
			const user2 = await createTestUser({
				profilePublic: true,
				displayName: "Second Place",
			});

			const ach1 = await createTestAchievement({ points: 100 });
			const ach2 = await createTestAchievement({ points: 50 });

			await createTestUserAchievement(user1.id, ach1.id);
			await createTestUserAchievement(user2.id, ach2.id);

			const response = await request(app).get("/achievements/leaderboard");

			expect(response.status).toBe(200);
			// First place should appear before second place in the HTML
			const firstPlaceIndex = response.text.indexOf("First Place");
			const secondPlaceIndex = response.text.indexOf("Second Place");
			expect(firstPlaceIndex).toBeLessThan(secondPlaceIndex);
		});

		it("should highlight current user if authenticated", async () => {
			const { user, tokens } = await createAuthenticatedUser({
				profilePublic: true,
			});
			const achievement = await createTestAchievement({ points: 50 });
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.get("/achievements/leaderboard")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("(You)");
		});

		it("should show user rank card when authenticated", async () => {
			const { user, tokens } = await createAuthenticatedUser({
				profilePublic: true,
			});
			const achievement = await createTestAchievement({ points: 50 });
			await createTestUserAchievement(user.id, achievement.id);

			const response = await request(app)
				.get("/achievements/leaderboard")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Your Rank");
		});

		it("should not show private profiles on leaderboard", async () => {
			const privateUser = await createTestUser({
				profilePublic: false,
				displayName: "Private User",
			});
			const achievement = await createTestAchievement({ points: 100 });
			await createTestUserAchievement(privateUser.id, achievement.id);

			const response = await request(app).get("/achievements/leaderboard");

			expect(response.status).toBe(200);
			expect(response.text).not.toContain("Private User");
		});
	});

	describe("GET /achievements/share/:achievementId/:odataId", () => {
		it("should display shared achievement for public profile", async () => {
			const user = await createTestUser({
				profilePublic: true,
				displayName: "Sharer",
			});
			const achievement = await createTestAchievement({
				name: "Shared Achievement",
				points: 50,
			});
			const userAchievement = await createTestUserAchievement(
				user.id,
				achievement.id,
			);

			const response = await request(app).get(
				`/achievements/share/${achievement.id}/${userAchievement.id}`,
			);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Shared Achievement");
			expect(response.text).toContain("Sharer");
			expect(response.text).toContain("50 points");
		});

		it("should return 403 for private profile", async () => {
			const user = await createTestUser({
				profilePublic: false,
				displayName: "Private User",
			});
			const achievement = await createTestAchievement({
				name: "Private Achievement",
			});
			const userAchievement = await createTestUserAchievement(
				user.id,
				achievement.id,
			);

			const response = await request(app).get(
				`/achievements/share/${achievement.id}/${userAchievement.id}`,
			);

			expect(response.status).toBe(403);
			expect(response.text).toContain("Private Profile");
		});

		it("should return 404 for non-existent achievement", async () => {
			const response = await request(app).get(
				"/achievements/share/fake-id/fake-ua-id",
			);

			expect(response.status).toBe(404);
			expect(response.text).toContain("Achievement Not Found");
		});

		it("should show share buttons on page", async () => {
			const user = await createTestUser({ profilePublic: true });
			const achievement = await createTestAchievement({
				name: "Shareable Achievement",
			});
			const userAchievement = await createTestUserAchievement(
				user.id,
				achievement.id,
			);

			const response = await request(app).get(
				`/achievements/share/${achievement.id}/${userAchievement.id}`,
			);

			expect(response.status).toBe(200);
			expect(response.text).toContain("twitter.com/intent/tweet");
			expect(response.text).toContain("facebook.com/sharer");
			expect(response.text).toContain("Copy Link");
		});
	});

	describe("Hidden achievements on achievements page", () => {
		it("should show mystery achievements section", async () => {
			const { tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "Visible", isHidden: false });
			await createTestAchievement({ name: "Hidden 1", isHidden: true });
			await createTestAchievement({ name: "Hidden 2", isHidden: true });

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Mystery Achievements");
			expect(response.text).toContain("2 Secret Achievement");
		});

		it("should not show hidden achievements in locked list", async () => {
			const { tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "Visible Achievement" });
			await createTestAchievement({
				name: "Hidden Achievement",
				isHidden: true,
			});

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Visible Achievement");
			expect(response.text).not.toContain("Hidden Achievement");
		});

		it("should show unlocked hidden achievements with share button", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			const hiddenAchievement = await createTestAchievement({
				name: "Earned Hidden Achievement",
				isHidden: true,
			});
			await createTestUserAchievement(user.id, hiddenAchievement.id);

			const response = await request(app)
				.get("/achievements")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				]);

			expect(response.status).toBe(200);
			expect(response.text).toContain("Earned Hidden Achievement");
			expect(response.text).toContain("/achievements/share/");
		});
	});

	describe("Achievement auto-award integration", () => {
		it("should auto-award achievements when logging weight", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "First Weigh-In" });

			// Log weight through the API
			const response = await request(app)
				.post("/progress/log")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				])
				.send({
					weight: 200,
					recordedAt: new Date().toISOString().split("T")[0],
				});

			expect(response.status).toBe(302); // Redirect after success

			// Check if achievement was awarded
			const userAchievements = await prisma.userAchievement.findMany({
				where: { userId: user.id },
				include: { achievement: true },
			});

			expect(userAchievements).toHaveLength(1);
			expect(userAchievements[0].achievement.name).toBe("First Weigh-In");
		});

		it("should award weight loss milestones automatically", async () => {
			const { user, tokens } = await createAuthenticatedUser();
			await createTestAchievement({ name: "First Weigh-In" });
			await createTestAchievement({ name: "5 lbs Lost" });

			// Log first weight
			await request(app)
				.post("/progress/log")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				])
				.send({
					weight: 200,
					recordedAt: new Date(
						Date.now() - 10 * 24 * 60 * 60 * 1000,
					).toISOString().split("T")[0],
				});

			// Log second weight (5 lbs lost)
			await request(app)
				.post("/progress/log")
				.set("Cookie", [
					`accessToken=${tokens.accessToken}`,
					`refreshToken=${tokens.refreshToken}`,
				])
				.send({
					weight: 195,
					recordedAt: new Date().toISOString().split("T")[0],
				});

			// Check achievements
			const userAchievements = await prisma.userAchievement.findMany({
				where: { userId: user.id },
				include: { achievement: true },
			});

			const achievementNames = userAchievements.map((ua) => ua.achievement.name);
			expect(achievementNames).toContain("5 lbs Lost");
		});
	});
});
