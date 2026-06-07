import request from "supertest";
import app from "../../src/server";
import { resetDatabase, createAuthenticatedUser, createTestTeam } from "../helpers";
import prisma from "../../src/services/database";

describe("Social Features (Posts and Comments)", () => {
	let authenticatedUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;
	let teamId: string;

	beforeEach(async () => {
		await resetDatabase();
		authenticatedUser = await createAuthenticatedUser();
		const team = await createTestTeam(authenticatedUser.user.id);
		teamId = team.id;
	});

	describe("POST /teams/:teamId/posts", () => {
		it("should create a new post", async () => {
			const postData = {
				type: "MILESTONE",
				title: "First 10 pounds lost",
				content: "I am so happy to share this milestone with the team!",
			};

			await request(app)
				.post(`/teams/${teamId}/posts`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.send(postData)
				.expect(302); // Redirect after creation

			const posts = await prisma.post.findMany({ where: { teamId } });
			expect(posts).toHaveLength(1);
			expect(posts[0].title).toBe(postData.title);
			expect(posts[0].content).toBe(postData.content);
			expect(posts[0].type).toBe(postData.type);
		});

		it("should reject post from non-team member", async () => {
			const otherUser = await createAuthenticatedUser({
				email: "other@example.com",
				username: "otheruser",
			});

			await request(app)
				.post(`/teams/${teamId}/posts`)
				.set("Cookie", [`refreshToken=${otherUser.tokens.refreshToken}`, `accessToken=${otherUser.tokens.accessToken}`])
				.send({ type: "GENERAL", content: "This should fail" })
				.expect(403);
		});
	});

	describe("POST /posts/:id/like", () => {
		it("should toggle like on a post", async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});

			// Like the post
			const likeResponse = await request(app)
				.post(`/posts/${post.id}/like`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			expect(likeResponse.body.data.liked).toBe(true);

			const like = await prisma.like.findFirst({
				where: { postId: post.id, userId: authenticatedUser.user.id },
			});
			expect(like).toBeDefined();

			// Unlike the post
			const unlikeResponse = await request(app)
				.post(`/posts/${post.id}/like`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			expect(unlikeResponse.body.data.liked).toBe(false);

			const unliked = await prisma.like.findFirst({
				where: { postId: post.id, userId: authenticatedUser.user.id },
			});
			expect(unliked).toBeNull();
		});
	});

	describe("DELETE /posts/:id", () => {
		it("should allow author to delete their post", async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});

			const deleteResponse = await request(app)
				.delete(`/posts/${post.id}`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			expect(deleteResponse.body.success).toBe(true);

			const deletedPost = await prisma.post.findUnique({ where: { id: post.id } });
			expect(deletedPost?.deletedAt).not.toBeNull();
		});

		it("should allow admin to delete any post", async () => {
			const otherUser = await createAuthenticatedUser({
				email: "other@example.com",
				username: "otheruser",
			});

			await prisma.teamMember.create({
				data: { teamId, userId: otherUser.user.id, role: "MEMBER" },
			});

			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: otherUser.user.id,
					type: "GENERAL",
					content: "Post by other user",
				},
			});

			// Update to admin
			await prisma.teamMember.update({
				where: { teamId_userId: { teamId, userId: authenticatedUser.user.id } },
				data: { role: "ADMIN" },
			});

			await request(app)
				.delete(`/posts/${post.id}`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			const deletedPost = await prisma.post.findUnique({ where: { id: post.id } });
			expect(deletedPost?.deletedAt).not.toBeNull();
		});
	});

	describe("GET /teams/:teamId (integrated feed)", () => {
		it("should display team feed", async () => {
			await prisma.post.createMany({
				data: [
					{
						teamId,
						authorId: authenticatedUser.user.id,
						type: "MILESTONE",
						title: "Lost 10 pounds",
						content: "Great progress!",
					},
					{
						teamId,
						authorId: authenticatedUser.user.id,
						type: "TIP",
						title: "Meal prep",
						content: "Meal prep ideas",
					},
				],
			});

			const response = await request(app)
				.get(`/teams/${teamId}`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			expect(response.text).toContain("Lost 10 pounds");
			expect(response.text).toContain("Meal prep");
		});

		it("should not show feed to non-members", async () => {
			const otherUser = await createAuthenticatedUser({
				email: "other@example.com",
				username: "otheruser",
			});

			const response = await request(app)
				.get(`/teams/${teamId}`)
				.set("Cookie", [`refreshToken=${otherUser.tokens.refreshToken}`, `accessToken=${otherUser.tokens.accessToken}`])
				.expect(200);

			// Non-members can view the team page but shouldn't see the feed section
			expect(response.text).not.toContain("Share something with your team");
		});
	});

	describe("POST /posts/:postId/comments", () => {
		let postId: string;

		beforeEach(async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});
			postId = post.id;
		});

		it("should create a comment", async () => {
			const commentResponse = await request(app)
				.post(`/posts/${postId}/comments`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.send({ content: "Great post!" })
				.expect(201);

			expect(commentResponse.body.success).toBe(true);

			const comments = await prisma.comment.findMany({ where: { postId } });
			expect(comments).toHaveLength(1);
			expect(comments[0].content).toBe("Great post!");
		});

		it("should reject comment from non-member", async () => {
			const otherUser = await createAuthenticatedUser({
				email: "other@example.com",
				username: "otheruser",
			});

			await request(app)
				.post(`/posts/${postId}/comments`)
				.set("Cookie", [`refreshToken=${otherUser.tokens.refreshToken}`, `accessToken=${otherUser.tokens.accessToken}`])
				.send({ content: "This should fail" })
				.expect(403);
		});
	});

	describe("POST /comments/:commentId/replies", () => {
		it("should create a reply", async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});

			const comment = await prisma.comment.create({
				data: {
					postId: post.id,
					authorId: authenticatedUser.user.id,
					content: "Parent comment",
				},
			});

			const replyResponse = await request(app)
				.post(`/comments/${comment.id}/replies`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.send({ content: "This is a reply" })
				.expect(201);

			expect(replyResponse.body.success).toBe(true);

			const reply = await prisma.comment.findFirst({
				where: { parentId: comment.id },
			});

			expect(reply).toBeDefined();
			expect(reply?.content).toBe("This is a reply");
		});
	});

	describe("DELETE /comments/:id", () => {
		it("should allow author to delete comment", async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});

			const comment = await prisma.comment.create({
				data: {
					postId: post.id,
					authorId: authenticatedUser.user.id,
					content: "Comment to delete",
				},
			});

			const deleteResponse = await request(app)
				.delete(`/comments/${comment.id}`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			expect(deleteResponse.body.success).toBe(true);

			const deleted = await prisma.comment.findUnique({ where: { id: comment.id } });
			expect(deleted?.deletedAt).not.toBeNull();
		});

		it("should cascade delete child comments", async () => {
			const post = await prisma.post.create({
				data: {
					teamId,
					authorId: authenticatedUser.user.id,
					type: "GENERAL",
					content: "Test post",
				},
			});

			const parent = await prisma.comment.create({
				data: {
					postId: post.id,
					authorId: authenticatedUser.user.id,
					content: "Parent comment",
				},
			});

			const child = await prisma.comment.create({
				data: {
					postId: post.id,
					authorId: authenticatedUser.user.id,
					content: "Child reply",
					parentId: parent.id,
				},
			});

			await request(app)
				.delete(`/comments/${parent.id}`)
				.set("Cookie", [`refreshToken=${authenticatedUser.tokens.refreshToken}`, `accessToken=${authenticatedUser.tokens.accessToken}`])
				.expect(200);

			const deletedParent = await prisma.comment.findUnique({ where: { id: parent.id } });
			const deletedChild = await prisma.comment.findUnique({ where: { id: child.id } });

			expect(deletedParent?.deletedAt).not.toBeNull();
			expect(deletedChild?.deletedAt).not.toBeNull();
		});
	});
});
