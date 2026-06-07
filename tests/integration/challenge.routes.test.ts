import request from "supertest";
import app from "../../src/server";
import {
	resetDatabase,
	createAuthenticatedUser,
	createTestTeam,
	createTestTeamMember,
	prisma,
} from "../helpers";

describe("Challenge Routes", () => {
	let teamOwner: Awaited<ReturnType<typeof createAuthenticatedUser>>;
	let teamMember: Awaited<ReturnType<typeof createAuthenticatedUser>>;
	let nonMember: Awaited<ReturnType<typeof createAuthenticatedUser>>;
	let team: Awaited<ReturnType<typeof createTestTeam>>;

	beforeEach(async () => {
		await resetDatabase();

		// Create users
		teamOwner = await createAuthenticatedUser({
			email: "owner@example.com",
			username: "teamowner",
		});

		teamMember = await createAuthenticatedUser({
			email: "member@example.com",
			username: "teammember",
		});

		nonMember = await createAuthenticatedUser({
			email: "nonmember@example.com",
			username: "nonmember",
		});

		// Create team with owner
		team = await createTestTeam(teamOwner.user.id, {
			name: "Test Team",
			description: "A test team for challenges",
		});

		// Add member to team
		await createTestTeamMember(team.id, teamMember.user.id, "MEMBER");
	});

	describe("GET /teams/:teamId/challenges", () => {
		it("should list challenges for team members", async () => {
			// Create a challenge
			await prisma.challenge.create({
				data: {
					name: "Weight Loss Challenge",
					description: "Lose 5% body weight in 30 days",
					type: "WEIGHT_LOSS_PERCENTAGE",
					status: "ACTIVE",
					startDate: new Date(),
					endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					targetValue: 5,
					teamId: team.id,
				},
			});

			const response = await request(app)
				.get(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Weight Loss Challenge");
			expect(response.text).toContain("Test Team");
		});

		it("should deny access to non-members", async () => {
			const response = await request(app)
				.get(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${nonMember.tokens.refreshToken}`,
					`accessToken=${nonMember.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.text).toContain("Access Denied");
		});

		it("should show participation status for user", async () => {
			const challenge = await prisma.challenge.create({
				data: {
					name: "Consistency Challenge",
					description: "Log weight daily for 7 days",
					type: "CONSISTENCY",
					status: "ACTIVE",
					startDate: new Date(),
					endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					targetValue: 7,
					teamId: team.id,
				},
			});

			// Join the challenge
			await prisma.challengeParticipant.create({
				data: {
					challengeId: challenge.id,
					userId: teamOwner.user.id,
					progress: 0,
				},
			});

			const response = await request(app)
				.get(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Consistency Challenge");
		});
	});

	describe("GET /teams/:teamId/challenges/new", () => {
		it("should show create form for team admins/owners", async () => {
			const response = await request(app)
				.get(`/teams/${team.id}/challenges/new`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Create Challenge");
		});

		it("should deny access to regular members", async () => {
			const response = await request(app)
				.get(`/teams/${team.id}/challenges/new`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.text).toContain("Only team admins");
		});

		it("should deny access to non-members", async () => {
			const response = await request(app)
				.get(`/teams/${team.id}/challenges/new`)
				.set("Cookie", [
					`refreshToken=${nonMember.tokens.refreshToken}`,
					`accessToken=${nonMember.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.text).toContain("Access Denied");
		});
	});

	describe("POST /teams/:teamId/challenges", () => {
		const validChallengeData = {
			name: "New Challenge",
			description:
				"This is a test challenge description that is long enough",
			type: "WEIGHT_LOSS_PERCENTAGE",
			startDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0],
			endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0],
			targetValue: "5",
			rewardPoints: "100",
		};

		it("should create challenge for team owner", async () => {
			const response = await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.send(validChallengeData)
				.expect(302);

			expect(response.headers.location).toContain(
				`/teams/${team.id}/challenges`,
			);
			expect(response.headers.location).toContain("success=");

			const challenge = await prisma.challenge.findFirst({
				where: { teamId: team.id, name: "New Challenge" },
			});
			expect(challenge).not.toBeNull();
			expect(challenge?.type).toBe("WEIGHT_LOSS_PERCENTAGE");
		});

		it("should create challenge for team admin", async () => {
			// Promote member to admin
			await prisma.teamMember.update({
				where: {
					teamId_userId: {
						teamId: team.id,
						userId: teamMember.user.id,
					},
				},
				data: { role: "ADMIN" },
			});

			await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.send(validChallengeData)
				.expect(302);

			const challenge = await prisma.challenge.findFirst({
				where: { teamId: team.id, name: "New Challenge" },
			});
			expect(challenge).not.toBeNull();
		});

		it("should deny creation for regular members", async () => {
			const response = await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send(validChallengeData)
				.expect(403);

			expect(response.body.success).toBe(false);
		});

		it("should validate required fields", async () => {
			const response = await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({
					name: "",
					description: "",
					type: "",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.errors).toBeDefined();
		});

		it("should validate end date is after start date", async () => {
			const response = await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({
					...validChallengeData,
					startDate: "2025-12-31",
					endDate: "2025-12-01",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should validate challenge type", async () => {
			const response = await request(app)
				.post(`/teams/${team.id}/challenges`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.set("Accept", "application/json")
				.send({
					...validChallengeData,
					type: "INVALID_TYPE",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /challenges/:id", () => {
		let challenge: { id: string };

		beforeEach(async () => {
			challenge = await prisma.challenge.create({
				data: {
					name: "Test Challenge",
					description: "A test challenge for viewing",
					type: "TOTAL_WEIGHT_LOSS",
					status: "ACTIVE",
					startDate: new Date(),
					endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					targetValue: 10,
					teamId: team.id,
				},
			});
		});

		it("should show challenge details for team members", async () => {
			const response = await request(app)
				.get(`/challenges/${challenge.id}`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.text).toContain("Test Challenge");
		});

		it("should show leaderboard with participants", async () => {
			// Add participants
			await prisma.challengeParticipant.create({
				data: {
					challengeId: challenge.id,
					userId: teamOwner.user.id,
					progress: 5,
				},
			});

			const response = await request(app)
				.get(`/challenges/${challenge.id}`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			// Leaderboard shows displayName || username - factory sets displayName to "Test User"
			expect(response.text).toContain("Leaderboard");
			expect(response.text).toContain("5.0"); // Progress value
		});

		it("should deny access to non-members", async () => {
			const response = await request(app)
				.get(`/challenges/${challenge.id}`)
				.set("Cookie", [
					`refreshToken=${nonMember.tokens.refreshToken}`,
					`accessToken=${nonMember.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.text).toContain("Access Denied");
		});

		it("should return 404 for non-existent challenge", async () => {
			const response = await request(app)
				.get("/challenges/00000000-0000-0000-0000-000000000000")
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(404);

			expect(response.text).toContain("Challenge Not Found");
		});
	});

	describe("POST /challenges/:id/join", () => {
		let challenge: { id: string };

		beforeEach(async () => {
			challenge = await prisma.challenge.create({
				data: {
					name: "Joinable Challenge",
					description: "A challenge that can be joined",
					type: "CONSISTENCY",
					status: "ACTIVE",
					startDate: new Date(),
					endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					targetValue: 7,
					teamId: team.id,
				},
			});
		});

		it("should allow team member to join challenge", async () => {
			const response = await request(app)
				.post(`/challenges/${challenge.id}/join`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.body.success).toBe(true);

			const participation = await prisma.challengeParticipant.findUnique({
				where: {
					challengeId_userId: {
						challengeId: challenge.id,
						userId: teamMember.user.id,
					},
				},
			});
			expect(participation).not.toBeNull();
		});

		it("should deny join for non-members", async () => {
			const response = await request(app)
				.post(`/challenges/${challenge.id}/join`)
				.set("Cookie", [
					`refreshToken=${nonMember.tokens.refreshToken}`,
					`accessToken=${nonMember.tokens.accessToken}`,
				])
				.expect(403);

			expect(response.body.success).toBe(false);
		});

		it("should prevent duplicate joins", async () => {
			// First join
			await prisma.challengeParticipant.create({
				data: {
					challengeId: challenge.id,
					userId: teamMember.user.id,
					progress: 0,
				},
			});

			// Try to join again
			const response = await request(app)
				.post(`/challenges/${challenge.id}/join`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("already participating");
		});

		it("should prevent joining completed challenges", async () => {
			// Update challenge to completed
			await prisma.challenge.update({
				where: { id: challenge.id },
				data: { status: "COMPLETED" },
			});

			const response = await request(app)
				.post(`/challenges/${challenge.id}/join`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("no longer accepting");
		});

		it("should allow joining upcoming challenges", async () => {
			// Update challenge to upcoming
			await prisma.challenge.update({
				where: { id: challenge.id },
				data: { status: "UPCOMING" },
			});

			const response = await request(app)
				.post(`/challenges/${challenge.id}/join`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should return 404 for non-existent challenge", async () => {
			const response = await request(app)
				.post("/challenges/00000000-0000-0000-0000-000000000000/join")
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /challenges/:id/leave", () => {
		let challenge: { id: string };

		beforeEach(async () => {
			challenge = await prisma.challenge.create({
				data: {
					name: "Leavable Challenge",
					description: "A challenge that can be left",
					type: "ACTIVITY_BASED",
					status: "ACTIVE",
					startDate: new Date(),
					endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					teamId: team.id,
				},
			});

			// Add member as participant
			await prisma.challengeParticipant.create({
				data: {
					challengeId: challenge.id,
					userId: teamMember.user.id,
					progress: 0,
				},
			});
		});

		it("should allow participant to leave challenge", async () => {
			const response = await request(app)
				.post(`/challenges/${challenge.id}/leave`)
				.set("Cookie", [
					`refreshToken=${teamMember.tokens.refreshToken}`,
					`accessToken=${teamMember.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.body.success).toBe(true);

			const participation = await prisma.challengeParticipant.findUnique({
				where: {
					challengeId_userId: {
						challengeId: challenge.id,
						userId: teamMember.user.id,
					},
				},
			});
			expect(participation).toBeNull();
		});

		it("should return 404 if not participating", async () => {
			const response = await request(app)
				.post(`/challenges/${challenge.id}/leave`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("not participating");
		});
	});

	describe("POST /challenges/:id/update-progress", () => {
		let challenge: { id: string };

		beforeEach(async () => {
			challenge = await prisma.challenge.create({
				data: {
					name: "Progress Challenge",
					description: "A challenge to test progress updates",
					type: "TOTAL_WEIGHT_LOSS",
					status: "ACTIVE",
					startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
					endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					targetValue: 10,
					teamId: team.id,
				},
			});

			// Add participants
			await prisma.challengeParticipant.create({
				data: {
					challengeId: challenge.id,
					userId: teamOwner.user.id,
					progress: 0,
				},
			});
		});

		it("should update progress for participants", async () => {
			// Create weight entries to calculate progress
			const startDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
			await prisma.weightEntry.create({
				data: {
					userId: teamOwner.user.id,
					weight: 200,
					recordedAt: startDate,
				},
			});

			await prisma.weightEntry.create({
				data: {
					userId: teamOwner.user.id,
					weight: 195,
					recordedAt: new Date(),
				},
			});

			const response = await request(app)
				.post(`/challenges/${challenge.id}/update-progress`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			expect(response.body.success).toBe(true);

			const participation = await prisma.challengeParticipant.findUnique({
				where: {
					challengeId_userId: {
						challengeId: challenge.id,
						userId: teamOwner.user.id,
					},
				},
			});
			expect(participation?.progress).toBe(5); // Lost 5 lbs
		});

		it("should mark challenge as completed when target reached", async () => {
			// Create weight entries showing target achieved
			const startDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
			await prisma.weightEntry.create({
				data: {
					userId: teamOwner.user.id,
					weight: 200,
					recordedAt: startDate,
				},
			});

			await prisma.weightEntry.create({
				data: {
					userId: teamOwner.user.id,
					weight: 188, // Lost 12 lbs, exceeds 10 lb target
					recordedAt: new Date(),
				},
			});

			await request(app)
				.post(`/challenges/${challenge.id}/update-progress`)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(200);

			const participation = await prisma.challengeParticipant.findUnique({
				where: {
					challengeId_userId: {
						challengeId: challenge.id,
						userId: teamOwner.user.id,
					},
				},
			});
			expect(participation?.completed).toBe(true);
			expect(participation?.completedAt).not.toBeNull();
		});

		it("should return 404 for non-existent challenge", async () => {
			const response = await request(app)
				.post(
					"/challenges/00000000-0000-0000-0000-000000000000/update-progress",
				)
				.set("Cookie", [
					`refreshToken=${teamOwner.tokens.refreshToken}`,
					`accessToken=${teamOwner.tokens.accessToken}`,
				])
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});
});
