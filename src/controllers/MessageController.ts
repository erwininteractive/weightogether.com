import { Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import { MessageService } from "../services/message.service";
import prisma from "../services/database";

export class MessageController {
	/**
	 * Validation for creating a new conversation
	 */
	static newConversationValidation = [
		body("participantId")
			.optional()
			.isUUID()
			.withMessage("Invalid participant ID"),
		body("participantIds")
			.optional()
			.isArray()
			.withMessage("Participant IDs must be an array"),
		body("participantIds.*")
			.optional()
			.isUUID()
			.withMessage("Invalid participant ID"),
		body("name")
			.optional()
			.isString()
			.isLength({ min: 1, max: 100 })
			.withMessage("Group name must be 1-100 characters"),
		body("isGroup").optional().isBoolean(),
	];

	/**
	 * Validation for sending a message
	 */
	static sendMessageValidation = [
		param("conversationId").isUUID().withMessage("Invalid conversation ID"),
		body("content")
			.isString()
			.isLength({ min: 1, max: 5000 })
			.withMessage("Message must be 1-5000 characters"),
	];

	/**
	 * Validation for message actions
	 */
	static messageActionValidation = [
		param("conversationId").isUUID().withMessage("Invalid conversation ID"),
		param("messageId").isUUID().withMessage("Invalid message ID"),
	];

	/**
	 * Validation for editing a message
	 */
	static editMessageValidation = [
		...MessageController.messageActionValidation,
		body("content")
			.isString()
			.isLength({ min: 1, max: 5000 })
			.withMessage("Message must be 1-5000 characters"),
	];

	/**
	 * Validation for marking a post as read
	 */
	static markPostReadValidation = [
		param("postId").isUUID().withMessage("Invalid post ID"),
	];

	/**
	 * GET /messages
	 * Show aggregated feed of unread posts from all teams the user is a member of
	 */
	static async listTeamFeeds(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			// Get all teams the user is a member of
			const memberships = await prisma.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			const teamIds = memberships.map((m) => m.teamId);

			// Get unread posts from all user's teams (posts without a PostRead record for this user)
			const posts = await prisma.post.findMany({
				where: {
					teamId: { in: teamIds },
					deletedAt: null,
					// Exclude posts that the user has already read
					reads: {
						none: {
							userId,
						},
					},
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
					team: {
						select: {
							id: true,
							name: true,
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
						where: { userId },
						select: { id: true },
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 50, // Limit to recent posts
			});

			// Transform posts to include isLiked flag
			const postsWithLikeStatus = posts.map((post) => ({
				...post,
				isLiked: post.likes.length > 0,
				likes: undefined,
			}));

			res.render("messages/index", {
				title: "Team Feed",
				posts: postsWithLikeStatus,
				user,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/posts/:postId/read
	 * Mark a team post as read
	 */
	static async markPostAsRead(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() });
				return;
			}

			const userId = req.user!.sub;
			const { postId } = req.params;

			// Verify the post exists and user has access (is in the team)
			const post = await prisma.post.findFirst({
				where: {
					id: postId,
					deletedAt: null,
					team: {
						members: {
							some: {
								userId,
							},
						},
					},
				},
			});

			if (!post) {
				res.status(404).json({
					error: "Post not found or you don't have access",
				});
				return;
			}

			// Create or update the PostRead record (upsert to handle duplicates)
			await prisma.postRead.upsert({
				where: {
					postId_userId: {
						postId,
						userId,
					},
				},
				create: {
					postId,
					userId,
				},
				update: {
					readAt: new Date(),
				},
			});

			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /messages/new
	 * Show form to start a new conversation
	 */
	static async newConversationForm(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const searchQuery = req.query.q as string | undefined;
			let users: {
				id: string;
				username: string;
				avatarUrl: string | null;
			}[] = [];

			if (searchQuery && searchQuery.length >= 2) {
				users = await MessageService.searchUsers(
					searchQuery,
					req.user!.sub,
				);
			}

			res.render("messages/new", {
				title: "New Conversation",
				users,
				searchQuery: searchQuery || "",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/new
	 * Create a new conversation (DM or group)
	 */
	static async createConversation(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const searchQuery = req.query.q as string | undefined;
				let users: {
					id: string;
					username: string;
					avatarUrl: string | null;
				}[] = [];
				if (searchQuery) {
					users = await MessageService.searchUsers(
						searchQuery,
						req.user!.sub,
					);
				}
				res.render("messages/new", {
					title: "New Conversation",
					users,
					searchQuery: searchQuery || "",
					errors: errors.array(),
				});
				return;
			}

			const userId = req.user!.sub;
			const { participantId, participantIds, name, isGroup } = req.body;

			let conversation;

			if (isGroup && participantIds) {
				// Create group conversation
				conversation = await MessageService.createGroupConversation(
					name || "Group Chat",
					userId,
					participantIds,
				);
			} else if (participantId) {
				// Create or get DM conversation
				conversation =
					await MessageService.getOrCreateDirectConversation(
						userId,
						participantId,
					);
			} else {
				res.render("messages/new", {
					title: "New Conversation",
					users: [],
					searchQuery: "",
					errors: [{ msg: "Please select a user to message" }],
				});
				return;
			}

			res.redirect(`/messages/${conversation.id}`);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /messages/:conversationId
	 * Show a conversation with messages
	 */
	static async showConversation(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { conversationId } = req.params;

			const conversation = await MessageService.getConversation(
				conversationId,
				userId,
			);

			if (!conversation) {
				res.status(404).render("errors/404", {
					title: "Conversation Not Found",
					message:
						"This conversation doesn't exist or you don't have access to it.",
				});
				return;
			}

			const messages = await MessageService.getMessages(
				conversationId,
				userId,
			);

			// Mark as read
			await MessageService.markAsRead(conversationId, userId);

			const displayName = MessageService.getConversationDisplayName(
				conversation,
				userId,
			);

			res.render("messages/show", {
				title: displayName,
				conversation,
				messages,
				displayName,
				currentUserId: userId,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/:conversationId
	 * Send a message to a conversation
	 */
	static async sendMessage(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() });
				return;
			}

			const userId = req.user!.sub;
			const { conversationId } = req.params;
			const { content } = req.body;

			await MessageService.sendMessage(conversationId, userId, content);

			// Check if this is an AJAX request
			if (req.xhr || req.headers.accept?.includes("application/json")) {
				res.json({ success: true });
			} else {
				res.redirect(`/messages/${conversationId}`);
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("not a participant")
			) {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "You are not a participant in this conversation.",
				});
				return;
			}
			next(error);
		}
	}

	/**
	 * PUT /messages/:conversationId/:messageId
	 * Edit a message
	 */
	static async editMessage(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() });
				return;
			}

			const userId = req.user!.sub;
			const { messageId } = req.params;
			const { content } = req.body;

			const message = await MessageService.editMessage(
				messageId,
				userId,
				content,
			);

			if (!message) {
				res.status(404).json({
					error: "Message not found or you cannot edit it",
				});
				return;
			}

			res.json({ success: true, message });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /messages/:conversationId/:messageId
	 * Delete a message
	 */
	static async deleteMessage(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { messageId } = req.params;

			const deleted = await MessageService.deleteMessage(
				messageId,
				userId,
			);

			if (!deleted) {
				res.status(404).json({
					error: "Message not found or you cannot delete it",
				});
				return;
			}

			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/:conversationId/read
	 * Mark a conversation as read
	 */
	static async markAsRead(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { conversationId } = req.params;

			await MessageService.markAsRead(conversationId, userId);

			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/messages/:conversationId/messages
	 * Get messages for a conversation (API endpoint for infinite scroll)
	 */
	static async getMessages(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { conversationId } = req.params;
			const before = req.query.before as string | undefined;
			const limit = parseInt(req.query.limit as string) || 50;

			const messages = await MessageService.getMessages(
				conversationId,
				userId,
				{ limit, before },
			);

			res.json({ messages });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/users/search
	 * Search for users to message
	 */
	static async searchUsers(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const searchQuery = req.query.q as string;

			if (!searchQuery || searchQuery.length < 2) {
				res.json({ users: [] });
				return;
			}

			const users = await MessageService.searchUsers(searchQuery, userId);
			res.json({ users });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /messages/team/:teamId
	 * Get team conversation with messages (creates if doesn't exist)
	 */
	static async getTeamConversation(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { teamId } = req.params;

			// Verify user is a member of the team and get team data
			const team = await prisma.team.findFirst({
				where: {
					id: teamId,
					members: {
						some: {
							userId,
						},
					},
				},
				include: {
					members: {
						select: {
							userId: true,
						},
					},
				},
			});

			if (!team) {
				res.status(403).json({
					error: "You are not a member of this team",
				});
				return;
			}

			// Get or create the team conversation
			const memberIds = team.members.map((m) => m.userId);
			const conversation =
				await MessageService.getOrCreateTeamConversation(
					teamId,
					team.name,
					memberIds,
				);

			// Get recent messages
			const messages = await MessageService.getMessages(
				conversation.id,
				userId,
				{ limit: 50 },
			);

			// Get unread count
			const unreadCount = await MessageService.getConversationUnreadCount(
				conversation.id,
				userId,
			);

			res.json({
				conversationId: conversation.id,
				messages,
				unreadCount,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/team/:teamId
	 * Send a message to the team conversation
	 */
	static async sendTeamMessage(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() });
				return;
			}

			const userId = req.user!.sub;
			const { teamId } = req.params;
			const { content } = req.body;

			// Verify user is a member of the team
			const team = await prisma.team.findFirst({
				where: {
					id: teamId,
					members: {
						some: {
							userId,
						},
					},
				},
				include: {
					members: {
						select: {
							userId: true,
						},
					},
				},
			});

			if (!team) {
				res.status(403).json({
					error: "You are not a member of this team",
				});
				return;
			}

			// Get or create the team conversation
			const memberIds = team.members.map((m) => m.userId);
			const conversation =
				await MessageService.getOrCreateTeamConversation(
					teamId,
					team.name,
					memberIds,
				);

			// Send the message
			const message = await MessageService.sendMessage(
				conversation.id,
				userId,
				content,
			);

			res.json({ success: true, message });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /messages/team/:teamId/read
	 * Mark team conversation as read
	 */
	static async markTeamAsRead(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user!.sub;
			const { teamId } = req.params;

			// Find the team conversation
			const conversation = await prisma.conversation.findFirst({
				where: {
					teamId,
					isGroup: true,
				},
			});

			if (!conversation) {
				res.status(404).json({ error: "Team conversation not found" });
				return;
			}

			await MessageService.markAsRead(conversation.id, userId);

			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Validation for team messages
	 */
	static teamMessageValidation = [
		param("teamId").isUUID().withMessage("Invalid team ID"),
		body("content")
			.isString()
			.isLength({ min: 1, max: 5000 })
			.withMessage("Message must be 1-5000 characters"),
	];
}
