import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";

/**
 * Controller for comment management
 */
export class CommentController {
	/**
	 * Validation rules for comment creation
	 */
	static commentValidation = [
		body("content")
			.notEmpty()
			.withMessage("Comment content is required")
			.trim()
			.isLength({ min: 1, max: 2000 })
			.withMessage("Comment must be between 1 and 2000 characters"),
	];

	/**
	 * POST /posts/:postId/comments
	 * Create a new comment on a post
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

			const { postId } = req.params;
			const userId = req.user!.sub;
			const { content } = req.body;

			// Check if post exists
			const post = await prisma.post.findUnique({
				where: { id: postId, deletedAt: null },
			});

			if (!post) {
				res.status(404).json({
					success: false,
					message: "Post not found",
				});
				return;
			}

			// Check if user has access to the post (team member check)
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
					res.status(403).json({
						success: false,
						message: "You must be a team member to comment on this post",
					});
					return;
				}
			}

			// Create the comment
			const comment = await prisma.comment.create({
				data: {
					postId,
					authorId: userId,
					content,
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
			});

			res.status(201).json({
				success: true,
				message: "Comment posted successfully",
				data: { comment },
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /comments/:commentId/replies
	 * Create a reply to a comment
	 */
	static async createReply(
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

			const { commentId } = req.params;
			const userId = req.user!.sub;
			const { content } = req.body;

			// Check if parent comment exists
			const parentComment = await prisma.comment.findUnique({
				where: { id: commentId, deletedAt: null },
				include: {
					post: {
						select: {
							id: true,
							teamId: true,
							deletedAt: true,
						},
					},
				},
			});

			if (!parentComment || parentComment.post.deletedAt) {
				res.status(404).json({
					success: false,
					message: "Comment not found",
				});
				return;
			}

			// Check if user has access to the post (team member check)
			if (parentComment.post.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: {
							teamId: parentComment.post.teamId,
							userId,
						},
					},
				});

				if (!membership) {
					res.status(403).json({
						success: false,
						message: "You must be a team member to reply to this comment",
					});
					return;
				}
			}

			// Create the reply
			const reply = await prisma.comment.create({
				data: {
					postId: parentComment.postId,
					authorId: userId,
					content,
					parentId: commentId,
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
			});

			res.status(201).json({
				success: true,
				message: "Reply posted successfully",
				data: { comment: reply },
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /comments/:id
	 * Update a comment (author only)
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
			const { content } = req.body;

			const comment = await prisma.comment.findUnique({
				where: { id, deletedAt: null },
			});

			if (!comment) {
				res.status(404).json({
					success: false,
					message: "Comment not found",
				});
				return;
			}

			// Only author can edit
			if (comment.authorId !== userId) {
				res.status(403).json({
					success: false,
					message: "You can only edit your own comments",
				});
				return;
			}

			const updatedComment = await prisma.comment.update({
				where: { id },
				data: {
					content,
					updatedAt: new Date(),
				},
			});

			res.json({
				success: true,
				message: "Comment updated successfully",
				data: { comment: updatedComment },
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /comments/:id
	 * Soft delete a comment (author or team admin/owner)
	 */
	static async delete(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const comment = await prisma.comment.findUnique({
				where: { id, deletedAt: null },
				include: {
					post: {
						select: {
							teamId: true,
						},
					},
				},
			});

			if (!comment) {
				res.status(404).json({
					success: false,
					message: "Comment not found",
				});
				return;
			}

			// Check if user is author or team admin/owner
			let canDelete = comment.authorId === userId;

			if (!canDelete && comment.post.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: {
							teamId: comment.post.teamId,
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
					message: "You don't have permission to delete this comment",
				});
				return;
			}

			// Soft delete comment and all its child replies
			const deletedAt = new Date();

			// First, soft delete all child comments (replies)
			await prisma.comment.updateMany({
				where: {
					parentId: id,
					deletedAt: null,
				},
				data: {
					deletedAt,
				},
			});

			// Then soft delete the parent comment
			await prisma.comment.update({
				where: { id },
				data: {
					deletedAt,
				},
			});

			res.json({
				success: true,
				message: "Comment deleted successfully",
			});
		} catch (error) {
			next(error);
		}
	}
}
