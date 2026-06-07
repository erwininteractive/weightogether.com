import prisma from "./database";
import { Conversation, Message, User } from "@prisma/client";
import { SocketService } from "./socket.service";

export interface ConversationWithDetails extends Conversation {
	participants: {
		user: {
			id: string;
			username: string;
			avatarUrl: string | null;
		};
		lastReadAt: Date | null;
	}[];
	messages: {
		id: string;
		content: string;
		createdAt: Date;
		sender: {
			id: string;
			username: string;
		};
	}[];
	_count: {
		messages: number;
	};
	unreadCount?: number;
}

export interface MessageWithSender extends Message {
	sender: {
		id: string;
		username: string;
		avatarUrl: string | null;
	};
}

export class MessageService {
	/**
	 * Get all conversations for a user
	 * @param userId - The user ID
	 * @param teamOnly - If true, only return team conversations
	 */
	static async getUserConversations(
		userId: string,
		teamOnly: boolean = false,
	): Promise<ConversationWithDetails[]> {
		const conversations = await prisma.conversation.findMany({
			where: {
				participants: {
					some: {
						userId,
					},
				},
				...(teamOnly && { teamId: { not: null } }),
			},
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
				messages: {
					orderBy: {
						createdAt: "desc",
					},
					take: 1,
					where: {
						deletedAt: null,
					},
					include: {
						sender: {
							select: {
								id: true,
								username: true,
							},
						},
					},
				},
				_count: {
					select: {
						messages: true,
					},
				},
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		// Calculate unread count for each conversation
		const conversationsWithUnread = await Promise.all(
			conversations.map(async (conv: (typeof conversations)[number]) => {
				const participant = conv.participants.find(
					(p: (typeof conv.participants)[number]) =>
						p.userId === userId,
				);
				const lastReadAt = participant?.lastReadAt || new Date(0);

				const unreadCount = await prisma.message.count({
					where: {
						conversationId: conv.id,
						createdAt: {
							gt: lastReadAt,
						},
						senderId: {
							not: userId,
						},
						deletedAt: null,
					},
				});

				return {
					...conv,
					unreadCount,
				};
			}),
		);

		return conversationsWithUnread;
	}

	/**
	 * Get or create a direct message conversation between two users
	 */
	static async getOrCreateDirectConversation(
		userId1: string,
		userId2: string,
	): Promise<Conversation> {
		// Look for existing DM conversation between these two users
		const existing = await prisma.conversation.findFirst({
			where: {
				isGroup: false,
				teamId: null,
				AND: [
					{
						participants: {
							some: {
								userId: userId1,
							},
						},
					},
					{
						participants: {
							some: {
								userId: userId2,
							},
						},
					},
				],
			},
			include: {
				participants: true,
			},
		});

		// If exists and has exactly 2 participants, return it
		if (existing && existing.participants.length === 2) {
			return existing;
		}

		// Create new DM conversation
		return prisma.conversation.create({
			data: {
				isGroup: false,
				participants: {
					create: [{ userId: userId1 }, { userId: userId2 }],
				},
			},
		});
	}

	/**
	 * Create a group conversation
	 */
	static async createGroupConversation(
		name: string,
		creatorId: string,
		participantIds: string[],
		teamId?: string,
	): Promise<Conversation> {
		// Ensure creator is in participants
		const allParticipants = new Set([creatorId, ...participantIds]);

		return prisma.conversation.create({
			data: {
				name,
				isGroup: true,
				teamId,
				participants: {
					create: Array.from(allParticipants).map((userId) => ({
						userId,
					})),
				},
			},
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});
	}

	/**
	 * Get a conversation by ID with permission check
	 */
	static async getConversation(
		conversationId: string,
		userId: string,
	): Promise<ConversationWithDetails | null> {
		const conversation = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				participants: {
					some: {
						userId,
					},
				},
			},
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
				messages: {
					orderBy: {
						createdAt: "desc",
					},
					take: 1,
					where: {
						deletedAt: null,
					},
					include: {
						sender: {
							select: {
								id: true,
								username: true,
							},
						},
					},
				},
				_count: {
					select: {
						messages: true,
					},
				},
			},
		});

		return conversation as ConversationWithDetails | null;
	}

	/**
	 * Get messages for a conversation with pagination
	 */
	static async getMessages(
		conversationId: string,
		userId: string,
		options: { limit?: number; before?: string } = {},
	): Promise<MessageWithSender[]> {
		const { limit = 50, before } = options;

		// First verify user is a participant
		const isParticipant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId,
				userId,
			},
		});

		if (!isParticipant) {
			return [];
		}

		const messages = await prisma.message.findMany({
			where: {
				conversationId,
				deletedAt: null,
				...(before && {
					createdAt: {
						lt: (
							await prisma.message.findUnique({
								where: { id: before },
							})
						)?.createdAt,
					},
				}),
			},
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						avatarUrl: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			take: limit,
		});

		// Return in chronological order
		return messages.reverse();
	}

	/**
	 * Send a message
	 */
	static async sendMessage(
		conversationId: string,
		senderId: string,
		content: string,
		mediaUrls?: string[],
	): Promise<MessageWithSender> {
		// Verify sender is a participant and get all participants
		const conversation = await prisma.conversation.findFirst({
			where: {
				id: conversationId,
				participants: {
					some: { userId: senderId },
				},
			},
			include: {
				participants: {
					select: {
						userId: true,
						user: {
							select: {
								id: true,
								username: true,
							},
						},
					},
				},
			},
		});

		if (!conversation) {
			throw new Error("User is not a participant in this conversation");
		}

		// Create message and update conversation timestamp
		const [message] = await prisma.$transaction([
			prisma.message.create({
				data: {
					conversationId,
					senderId,
					content,
					mediaUrls: mediaUrls || [],
				},
				include: {
					sender: {
						select: {
							id: true,
							username: true,
							avatarUrl: true,
						},
					},
				},
			}),
			prisma.conversation.update({
				where: { id: conversationId },
				data: { updatedAt: new Date() },
			}),
		]);

		// Send real-time notification to other participants
		const recipientIds = conversation.participants
			.map((p) => p.userId)
			.filter((id) => id !== senderId);

		// Determine conversation display name for notification
		let conversationName: string;
		if (conversation.isGroup && conversation.name) {
			conversationName = conversation.name;
		} else {
			// For DMs, use sender's name as the notification title
			conversationName = message.sender.username;
		}

		SocketService.notifyNewMessage(
			recipientIds,
			{
				id: message.id,
				conversationId: message.conversationId,
				content: message.content,
				sender: message.sender,
				createdAt: message.createdAt,
			},
			conversationName,
		);

		return message;
	}

	/**
	 * Edit a message (only by sender)
	 */
	static async editMessage(
		messageId: string,
		userId: string,
		newContent: string,
	): Promise<Message | null> {
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				senderId: userId,
				deletedAt: null,
			},
		});

		if (!message) {
			return null;
		}

		return prisma.message.update({
			where: { id: messageId },
			data: {
				content: newContent,
				isEdited: true,
			},
		});
	}

	/**
	 * Soft delete a message (only by sender)
	 */
	static async deleteMessage(
		messageId: string,
		userId: string,
	): Promise<boolean> {
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				senderId: userId,
				deletedAt: null,
			},
		});

		if (!message) {
			return false;
		}

		await prisma.message.update({
			where: { id: messageId },
			data: { deletedAt: new Date() },
		});

		return true;
	}

	/**
	 * Mark conversation as read
	 */
	static async markAsRead(
		conversationId: string,
		userId: string,
	): Promise<void> {
		await prisma.conversationParticipant.updateMany({
			where: {
				conversationId,
				userId,
			},
			data: {
				lastReadAt: new Date(),
			},
		});
	}

	/**
	 * Search for users to start a conversation with
	 */
	static async searchUsers(
		query: string,
		currentUserId: string,
		limit = 10,
	): Promise<Pick<User, "id" | "username" | "avatarUrl">[]> {
		return prisma.user.findMany({
			where: {
				id: { not: currentUserId },
				emailVerified: true,
				OR: [
					{ username: { contains: query, mode: "insensitive" } },
					{ email: { contains: query, mode: "insensitive" } },
				],
			},
			select: {
				id: true,
				username: true,
				avatarUrl: true,
			},
			take: limit,
		});
	}

	/**
	 * Get display name for a conversation
	 * For DMs: returns other participant's name
	 * For groups: returns conversation name
	 */
	static getConversationDisplayName(
		conversation: ConversationWithDetails,
		currentUserId: string,
	): string {
		if (conversation.isGroup && conversation.name) {
			return conversation.name;
		}

		// For DMs, find the other participant
		const otherParticipant = conversation.participants.find(
			(p) => p.user.id !== currentUserId,
		);

		return otherParticipant?.user.username || "Unknown User";
	}

	/**
	 * Get or create a team conversation
	 * Creates a group conversation linked to the team with all members as participants
	 */
	static async getOrCreateTeamConversation(
		teamId: string,
		teamName: string,
		memberIds: string[],
	): Promise<ConversationWithDetails> {
		// Look for existing team conversation
		let conversation = await prisma.conversation.findFirst({
			where: {
				teamId,
				isGroup: true,
			},
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
				messages: {
					orderBy: {
						createdAt: "desc",
					},
					take: 1,
					where: {
						deletedAt: null,
					},
					include: {
						sender: {
							select: {
								id: true,
								username: true,
							},
						},
					},
				},
				_count: {
					select: {
						messages: true,
					},
				},
			},
		});

		// If no conversation exists, create one
		if (!conversation) {
			conversation = await prisma.conversation.create({
				data: {
					name: `${teamName} Chat`,
					isGroup: true,
					teamId,
					participants: {
						create: memberIds.map((userId) => ({ userId })),
					},
				},
				include: {
					participants: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									avatarUrl: true,
								},
							},
						},
					},
					messages: {
						orderBy: {
							createdAt: "desc",
						},
						take: 1,
						where: {
							deletedAt: null,
						},
						include: {
							sender: {
								select: {
									id: true,
									username: true,
								},
							},
						},
					},
					_count: {
						select: {
							messages: true,
						},
					},
				},
			});
		}

		return conversation as ConversationWithDetails;
	}

	/**
	 * Sync team conversation participants with current team members
	 * Adds new members and removes departed members
	 */
	static async syncTeamConversationParticipants(
		teamId: string,
		currentMemberIds: string[],
	): Promise<void> {
		const conversation = await prisma.conversation.findFirst({
			where: {
				teamId,
				isGroup: true,
			},
			include: {
				participants: true,
			},
		});

		if (!conversation) {
			return; // No team conversation exists yet
		}

		const existingParticipantIds = conversation.participants.map(
			(p) => p.userId,
		);
		const memberIdSet = new Set(currentMemberIds);
		const existingIdSet = new Set(existingParticipantIds);

		// Find members to add (in team but not in conversation)
		const toAdd = currentMemberIds.filter((id) => !existingIdSet.has(id));

		// Find members to remove (in conversation but not in team)
		const toRemove = existingParticipantIds.filter(
			(id) => !memberIdSet.has(id),
		);

		// Add new participants
		if (toAdd.length > 0) {
			await prisma.conversationParticipant.createMany({
				data: toAdd.map((userId) => ({
					conversationId: conversation.id,
					userId,
				})),
				skipDuplicates: true,
			});
		}

		// Remove departed participants
		if (toRemove.length > 0) {
			await prisma.conversationParticipant.deleteMany({
				where: {
					conversationId: conversation.id,
					userId: {
						in: toRemove,
					},
				},
			});
		}
	}

	/**
	 * Get unread count for a specific conversation
	 */
	static async getConversationUnreadCount(
		conversationId: string,
		userId: string,
	): Promise<number> {
		const participant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId,
				userId,
			},
		});

		if (!participant) {
			return 0;
		}

		const lastReadAt = participant.lastReadAt || new Date(0);

		return prisma.message.count({
			where: {
				conversationId,
				createdAt: { gt: lastReadAt },
				senderId: { not: userId },
				deletedAt: null,
			},
		});
	}
}
