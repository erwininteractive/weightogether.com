import request from "supertest";
import app from "../../src/server";
import {
	prisma,
	resetDatabase,
	createAuthenticatedUser,
	createTestTeam,
	createTestTeamMember,
} from "../helpers";
import { TeamRole } from "@prisma/client";

describe("Team Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("GET /teams", () => {
		it("should render teams page for authenticated user", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/teams")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("My Teams");
		});

		it("should display user's teams", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await createTestTeam(user.id, {
				name: "Test Team",
			});

			const response = await request(app)
				.get("/teams")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Test Team");
		});

		it("should display public teams for discovery", async () => {
			const { tokens } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			await createTestTeam(user2.id, {
				name: "Public Team",
				isPublic: true,
			});

			const response = await request(app)
				.get("/teams")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Public Team");
		});

		it("should not display private teams in discovery", async () => {
			const { tokens } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			await createTestTeam(user2.id, {
				name: "Private Team",
				isPublic: false,
			});

			const response = await request(app)
				.get("/teams")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).not.toContain("Private Team");
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app).get("/teams").expect(302);

			expect(response.headers.location).toContain("/login");
		});
	});

	describe("GET /teams/create", () => {
		it("should render team creation form", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/teams/create")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Create Team");
		});
	});

	describe("POST /teams/create", () => {
		it("should create new team", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/teams/create")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					name: "New Team",
					description: "Test description",
					isPublic: "true",
					maxMembers: "50",
				})
				.expect(302);

			expect(response.headers.location).toContain("/teams/");
			expect(response.headers.location).toContain("success=");

			const team = await prisma.team.findUnique({
				where: { name: "New Team" },
			});

			expect(team).toBeDefined();
			expect(team?.ownerId).toBe(user.id);
			expect(team?.description).toBe("Test description");
		});

		it("should create team membership for owner", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await request(app)
				.post("/teams/create")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					name: "New Team",
					isPublic: "true",
				})
				.expect(302);

			const team = await prisma.team.findUnique({
				where: { name: "New Team" },
			});

			const membership = await prisma.teamMember.findFirst({
				where: {
					teamId: team?.id,
					userId: user.id,
				},
			});

			expect(membership).toBeDefined();
			expect(membership?.role).toBe(TeamRole.OWNER);
		});

		it("should validate team name length", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.post("/teams/create")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					name: "AB", // Too short
					isPublic: "true",
				})
				.expect(200);

			expect(response.text).toContain("must be between");
		});

		it("should prevent duplicate team names", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			await createTestTeam(user.id, { name: "Existing Team" });

			const response = await request(app)
				.post("/teams/create")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({
					name: "Existing Team",
					isPublic: "true",
				})
				.expect(200);

			expect(response.text).toContain("already exists");
		});
	});

	describe("GET /teams/:id", () => {
		it("should display team details for member", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(user.id, {
				name: "Test Team",
			});

			const response = await request(app)
				.get(`/teams/${team.id}`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Test Team");
		});

		it("should display team details for non-member if public", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Public Team",
				isPublic: true,
			});

			const response = await request(app)
				.get(`/teams/${team.id}`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Public Team");
		});

		it("should deny access to private team for non-members", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Private Team",
				isPublic: false,
			});

			const response = await request(app)
				.get(`/teams/${team.id}`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("error=");
		});

		it("should redirect if team not found", async () => {
			const { tokens } = await createAuthenticatedUser();

			const response = await request(app)
				.get("/teams/non-existent-id")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("error=");
		});
	});

	describe("POST /teams/:id/join", () => {
		it("should join public team", async () => {
			const { user: user1, tokens } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Public Team",
				isPublic: true,
			});

			const response = await request(app)
				.post(`/teams/${team.id}/join`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("success=");

			const membership = await prisma.teamMember.findFirst({
				where: {
					teamId: team.id,
					userId: user1.id,
				},
			});

			expect(membership).toBeDefined();
			expect(membership?.role).toBe(TeamRole.MEMBER);
		});

		it("should not join private team without invite", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Private Team",
				isPublic: false,
			});

			const response = await request(app)
				.post(`/teams/${team.id}/join`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("error=");
		});

		it("should not join team if already member", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(user.id, {
				name: "My Team",
			});

			const response = await request(app)
				.post(`/teams/${team.id}/join`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			// Should redirect to team page without error
			expect(response.headers.location).toBe(`/teams/${team.id}`);
		});

		it("should not join full team", async () => {
			const { tokens: tokens1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Full Team",
				isPublic: true,
			});

			// Update team to maxMembers: 1 (owner only)
			await prisma.team.update({
				where: { id: team.id },
				data: { maxMembers: 1 },
			});

			const response = await request(app)
				.post(`/teams/${team.id}/join`)
				.set("Cookie", [`refreshToken=${tokens1.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("error=");
			expect(response.headers.location).toContain("full");
		});
	});

	describe("POST /teams/:id/leave", () => {
		it("should leave team", async () => {
			const { user: user1, tokens } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id, {
				name: "Test Team",
			});

			await createTestTeamMember(team.id, user1.id, TeamRole.MEMBER);

			const response = await request(app)
				.post(`/teams/${team.id}/leave`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("success=");

			const membership = await prisma.teamMember.findFirst({
				where: {
					teamId: team.id,
					userId: user1.id,
				},
			});

			expect(membership).toBeNull();
		});

		it("should not allow owner to leave team", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(user.id, {
				name: "My Team",
			});

			const response = await request(app)
				.post(`/teams/${team.id}/leave`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("error=");
			expect(response.headers.location).toContain("owner");
		});
	});

	describe("POST /teams/:id/members/:memberId/role", () => {
		it("should update member role (admin)", async () => {
			const { user: owner, tokens: ownerTokens } =
				await createAuthenticatedUser({
					email: "owner@example.com",
				});
			const { user: member } = await createAuthenticatedUser({
				email: "member@example.com",
			});

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			const membership = await createTestTeamMember(
				team.id,
				member.id,
				TeamRole.MEMBER,
			);

			const response = await request(app)
				.post(`/teams/${team.id}/members/${membership.id}/role`)
				.set("Cookie", [`refreshToken=${ownerTokens.refreshToken}`])
				.send({ role: "ADMIN" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.role).toBe("ADMIN");

			const updatedMembership = await prisma.teamMember.findUnique({
				where: { id: membership.id },
			});

			expect(updatedMembership?.role).toBe(TeamRole.ADMIN);
		});

		it("should not allow non-admin to change roles", async () => {
			const { user: owner } = await createAuthenticatedUser({
				email: "owner@example.com",
			});
			const { user: member1, tokens: member1Tokens } =
				await createAuthenticatedUser({
					email: "member1@example.com",
				});
			const { user: member2 } = await createAuthenticatedUser({
				email: "member2@example.com",
			});

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			await createTestTeamMember(team.id, member1.id, TeamRole.MEMBER);
			const membership2 = await createTestTeamMember(
				team.id,
				member2.id,
				TeamRole.MEMBER,
			);

			const response = await request(app)
				.post(`/teams/${team.id}/members/${membership2.id}/role`)
				.set("Cookie", [`refreshToken=${member1Tokens.refreshToken}`])
				.send({ role: "ADMIN" })
				.expect(403);

			expect(response.body.error).toBeDefined();
		});

		it("should not allow changing owner's role", async () => {
			const { user: owner, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			const ownerMembership = await prisma.teamMember.findFirst({
				where: {
					teamId: team.id,
					userId: owner.id,
				},
			});

			const response = await request(app)
				.post(
					`/teams/${team.id}/members/${ownerMembership?.id}/role`,
				)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.send({ role: "MEMBER" })
				.expect(400);

			expect(response.body.error).toContain("owner");
		});
	});

	describe("POST /teams/:id/members/:memberId/remove", () => {
		it("should remove member (admin)", async () => {
			const { user: owner, tokens: ownerTokens } =
				await createAuthenticatedUser({
					email: "owner@example.com",
				});
			const { user: member } = await createAuthenticatedUser({
				email: "member@example.com",
			});

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			const membership = await createTestTeamMember(
				team.id,
				member.id,
				TeamRole.MEMBER,
			);

			const response = await request(app)
				.post(`/teams/${team.id}/members/${membership.id}/remove`)
				.set("Cookie", [`refreshToken=${ownerTokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("success=");

			const removedMembership = await prisma.teamMember.findUnique({
				where: { id: membership.id },
			});

			expect(removedMembership).toBeNull();
		});

		it("should not allow non-moderator to remove members", async () => {
			const { user: owner } = await createAuthenticatedUser({
				email: "owner@example.com",
			});
			const { user: member1, tokens: member1Tokens } =
				await createAuthenticatedUser({
					email: "member1@example.com",
				});
			const { user: member2 } = await createAuthenticatedUser({
				email: "member2@example.com",
			});

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			await createTestTeamMember(team.id, member1.id, TeamRole.MEMBER);
			const membership2 = await createTestTeamMember(
				team.id,
				member2.id,
				TeamRole.MEMBER,
			);

			const response = await request(app)
				.post(`/teams/${team.id}/members/${membership2.id}/remove`)
				.set("Cookie", [`refreshToken=${member1Tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("error=");
		});

		it("should not allow removing owner", async () => {
			const { user: owner, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			const ownerMembership = await prisma.teamMember.findFirst({
				where: {
					teamId: team.id,
					userId: owner.id,
				},
			});

			const response = await request(app)
				.post(
					`/teams/${team.id}/members/${ownerMembership?.id}/remove`,
				)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("error=");
			expect(response.headers.location).toContain("owner");
		});
	});

	describe("POST /teams/:id/delete", () => {
		it("should delete team (owner only)", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const team = await createTestTeam(user.id, {
				name: "Test Team",
			});

			const response = await request(app)
				.post(`/teams/${team.id}/delete`)
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/teams");
			expect(response.headers.location).toContain("success=");

			const deletedTeam = await prisma.team.findUnique({
				where: { id: team.id },
			});

			expect(deletedTeam).toBeNull();
		});

		it("should not allow non-owner to delete team", async () => {
			const { user: owner } = await createAuthenticatedUser({
				email: "owner@example.com",
			});
			const { tokens: memberTokens } = await createAuthenticatedUser({
				email: "member@example.com",
			});

			const team = await createTestTeam(owner.id, {
				name: "Test Team",
			});

			const response = await request(app)
				.post(`/teams/${team.id}/delete`)
				.set("Cookie", [`refreshToken=${memberTokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain(`/teams/${team.id}`);
			expect(response.headers.location).toContain("error=");

			// Team should still exist
			const stillExists = await prisma.team.findUnique({
				where: { id: team.id },
			});

			expect(stillExists).toBeDefined();
		});
	});
});
