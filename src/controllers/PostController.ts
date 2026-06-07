import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import { PostType } from "@prisma/client";
import { AchievementService } from "../services/achievement.service";

/**
 * Controller for post management (social features)
 */
export class PostController {
	/**
	 * Validation rules for post creation/update
	 */
	static postValidation = [
		body("title")
			.optional({ checkFalsy: true })
			.trim()
			.isLength({ max: 200 })
			.withMessage("Title must be less than 200 characters"),
		body("content")
			.notEmpty()
			.withMessage("Post content is required")
			.trim()
			.isLength({ min: 1, max: 5000 })
			.withMessage("Content must be between 1 and 5000 characters"),
		body("type")
			.optional()
			.isIn(["GENERAL", "MILESTONE", "TIP", "QUESTION", "RECIPE", "WORKOUT"])
			.withMessage("Invalid post type"),
		body("teamId")
			.optional({ checkFalsy: true })
			.isUUID()
			.withMessage("Invalid team ID"),
	];

	/**
	 * GET /teams/:teamId/feed
	 * Display posts for a specific team
	 */
	static async teamFeed(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { teamId } = req.params;
			const userId = req.user!.sub;

			// Verify user is a team member
			const membership = await prisma.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId,
						userId,
					},
				},
			});

			if (!membership) {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "You must be a team member to view this feed",
				});
				return;
			}

			// Get team info
			const team = await prisma.team.findUnique({
				where: { id: teamId },
				select: {
					id: true,
					name: true,
					description: true,
					avatarUrl: true,
				},
			});

			if (!team) {
				res.status(404).render("errors/404", {
					title: "Team Not Found",
					message: "The team you're looking for doesn't exist",
				});
				return;
			}

			// Get posts for this team
			const posts = await prisma.post.findMany({
				where: {
					teamId,
					deletedAt: null,
				},
				include: {
					author: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: {
						where: {
							userId,
						},
						select: {
							id: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			// Transform posts to include isLiked flag
			const postsWithLikeStatus = posts.map((post) => ({
				...post,
				isLiked: post.likes.length > 0,
				likes: undefined,
			}));

			res.render("posts/feed", {
				title: `${team.name} Feed`,
				team,
				posts: postsWithLikeStatus,
				userRole: membership.role,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:teamId/posts
	 * Create a new post in a team
	 */
	static async create(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({
					success: false,
					errors: errors.array(),
				});
				return;
			}

			const { teamId } = req.params;
			const userId = req.user!.sub;
			const { title, content, type, tags } = req.body;

			// Verify user is a team member
			const membership = await prisma.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId,
						userId,
					},
				},
			});

			if (!membership) {
				res.status(403).json({
					success: false,
					message: "You must be a team member to post here",
				});
				return;
			}

			// Create the post
			await prisma.post.create({
				data: {
					authorId: userId,
					teamId,
					title: title || null,
					content,
					type: (type as PostType) || "GENERAL",
					visibility: "TEAM",
					tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
				},
			});

			// Check for achievement unlocks
			try {
				await AchievementService.checkEngagementAchievements(userId);
			} catch (error) {
				// Log error but don't fail the request
				console.error("Error checking achievements:", error);
			}

			// Redirect back to team feed on success
			res.redirect(`/teams/${teamId}?success=Post created successfully`);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /posts/:id
	 * View a single post with comments
	 */
	static async show(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const post = await prisma.post.findUnique({
				where: { id, deletedAt: null },
				include: {
					author: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
					team: {
						select: {
							id: true,
							name: true,
						},
					},
					comments: {
						where: {
							deletedAt: null,
							parentId: null,
						},
						include: {
							author: {
								select: {
									id: true,
									username: true,
									displayName: true,
									avatarUrl: true,
								},
							},
							replies: {
								where: {
									deletedAt: null,
								},
								include: {
									author: {
										select: {
											id: true,
											username: true,
											displayName: true,
											avatarUrl: true,
										},
									},
								},
								orderBy: {
									createdAt: "asc",
								},
							},
						},
						orderBy: {
							createdAt: "desc",
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: {
						where: {
							userId,
						},
						select: {
							id: true,
						},
					},
				},
			});

			if (!post) {
				res.status(404).render("errors/404", {
					title: "Post Not Found",
					message: "This post doesn't exist or has been deleted",
				});
				return;
			}

			// Check access permissions
			if (post.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: {
							teamId: post.teamId,
							userId,
						},
					},
				});

				if (!membership) {
					res.status(403).render("errors/403", {
						title: "Access Denied",
						message: "You must be a team member to view this post",
					});
					return;
				}
			}

			res.render("posts/show", {
				title: post.title || "Post",
				post: {
					...post,
					isLiked: post.likes.length > 0,
					likes: undefined,
				},
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /posts/:id
	 * Update a post (author only)
	 */
	static async update(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({
					success: false,
					errors: errors.array(),
				});
				return;
			}

			const { id } = req.params;
			const userId = req.user!.sub;
			const { title, content, type, tags } = req.body;

			const post = await prisma.post.findUnique({
				where: { id, deletedAt: null },
			});

			if (!post) {
				res.status(404).json({
					success: false,
					message: "Post not found",
				});
				return;
			}

			if (post.authorId !== userId) {
				res.status(403).json({
					success: false,
					message: "You can only edit your own posts",
				});
				return;
			}

			const updatedPost = await prisma.post.update({
				where: { id },
				data: {
					title: title || null,
					content,
					type: (type as PostType) || post.type,
					tags: tags ? (Array.isArray(tags) ? tags : [tags]) : post.tags,
					updatedAt: new Date(),
				},
			});

			res.json({
				success: true,
				message: "Post updated successfully",
				data: { post: updatedPost },
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /posts/:id
	 * Soft delete a post (author or team admin/owner)
	 */
	static async delete(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const post = await prisma.post.findUnique({
				where: { id, deletedAt: null },
			});

			if (!post) {
				res.status(404).json({
					success: false,
					message: "Post not found",
				});
				return;
			}

			let canDelete = post.authorId === userId;

			if (!canDelete && post.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: {
							teamId: post.teamId,
							userId,
						},
					},
				});

				canDelete =
					membership?.role === "ADMIN" || membership?.role === "OWNER";
			}

			if (!canDelete) {
				res.status(403).json({
					success: false,
					message: "You don't have permission to delete this post",
				});
				return;
			}

			await prisma.post.update({
				where: { id },
				data: {
					deletedAt: new Date(),
				},
			});

			res.json({
				success: true,
				message: "Post deleted successfully",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /posts/:id/like
	 * Like or unlike a post
	 */
	static async toggleLike(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const post = await prisma.post.findUnique({
				where: { id, deletedAt: null },
			});

			if (!post) {
				res.status(404).json({
					success: false,
					message: "Post not found",
				});
				return;
			}

			const existingLike = await prisma.like.findUnique({
				where: {
					postId_userId: {
						postId: id,
						userId,
					},
				},
			});

			if (existingLike) {
				await prisma.like.delete({
					where: {
						postId_userId: {
							postId: id,
							userId,
						},
					},
				});

				res.json({
					success: true,
					message: "Post unliked",
					data: { liked: false },
				});
			} else {
				await prisma.like.create({
					data: {
						postId: id,
						userId,
					},
				});

				res.json({
					success: true,
					message: "Post liked",
					data: { liked: true },
				});
			}
		} catch (error) {
			next(error);
		}
	}
}
