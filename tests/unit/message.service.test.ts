import { describe, it, expect, beforeEach } from "@jest/globals";
import { MessageService } from "../../src/services/message.service";
import { resetDatabase, prisma } from "../helpers/db";
import {
	createTestUser,
	createTestConversation,
	createTestMessage,
} from "../helpers/factories";

describe("MessageService", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("getOrCreateDirectConversation", () => {
		it("should create a new DM conversation between two users", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			const conversation = await MessageService.getOrCreateDirectConversation(
				user1.id,
				user2.id,
			);

			expect(conversation).toBeDefined();
			expect(conversation.isGroup).toBe(false);

			// Verify participants
			const participants = await prisma.conversationParticipant.findMany({
				where: { conversationId: conversation.id },
			});
			expect(participants).toHaveLength(2);
			expect(participants.map((p) => p.userId)).toContain(user1.id);
			expect(participants.map((p) => p.userId)).toContain(user2.id);
		});

		it("should return existing DM conversation if one exists", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			// Create first conversation
			const conv1 = await MessageService.getOrCreateDirectConversation(
				user1.id,
				user2.id,
			);

			// Try to create again
			const conv2 = await MessageService.getOrCreateDirectConversation(
				user1.id,
				user2.id,
			);

			expect(conv1.id).toBe(conv2.id);
		});

		it("should return existing conversation regardless of user order", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			const conv1 = await MessageService.getOrCreateDirectConversation(
				user1.id,
				user2.id,
			);

			// Create with reversed order
			const conv2 = await MessageService.getOrCreateDirectConversation(
				user2.id,
				user1.id,
			);

			expect(conv1.id).toBe(conv2.id);
		});
	});

	describe("createGroupConversation", () => {
		it("should create a group conversation with multiple participants", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const user3 = await createTestUser();

			const conversation = await MessageService.createGroupConversation(
				"Test Group",
				user1.id,
				[user2.id, user3.id],
			);

			expect(conversation).toBeDefined();
			expect(conversation.name).toBe("Test Group");
			expect(conversation.isGroup).toBe(true);

			// Verify participants in database
			const participants = await prisma.conversationParticipant.findMany({
				where: { conversationId: conversation.id },
			});
			expect(participants).toHaveLength(3);
		});

		it("should include creator in participants even if not specified", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			const conversation = await MessageService.createGroupConversation(
				"Test Group",
				user1.id,
				[user2.id], // Not including creator
			);

			// Verify participants in database
			const participants = await prisma.conversationParticipant.findMany({
				where: { conversationId: conversation.id },
			});
			const participantIds = participants.map((p) => p.userId);
			expect(participantIds).toContain(user1.id);
			expect(participantIds).toContain(user2.id);
		});
	});

	describe("sendMessage", () => {
		it("should send a message to a conversation", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const message = await MessageService.sendMessage(
				conversation.id,
				user1.id,
				"Hello, world!",
			);

			expect(message).toBeDefined();
			expect(message.content).toBe("Hello, world!");
			expect(message.senderId).toBe(user1.id);
			expect(message.conversationId).toBe(conversation.id);
		});

		it("should throw error if user is not a participant", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const outsider = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			await expect(
				MessageService.sendMessage(conversation.id, outsider.id, "Hello!"),
			).rejects.toThrow("User is not a participant in this conversation");
		});

		it("should update conversation timestamp when sending message", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const beforeUpdate = conversation.updatedAt;

			// Wait a bit to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 10));

			await MessageService.sendMessage(conversation.id, user1.id, "Hello!");

			const updatedConversation = await prisma.conversation.findUnique({
				where: { id: conversation.id },
			});

			expect(updatedConversation!.updatedAt.getTime()).toBeGreaterThan(
				beforeUpdate.getTime(),
			);
		});
	});

	describe("getMessages", () => {
		it("should return messages in chronological order", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			// Create messages with explicit timestamps
			const baseTime = new Date();
			await createTestMessage(conversation.id, user1.id, {
				content: "First",
				createdAt: new Date(baseTime.getTime() - 2000),
			});
			await createTestMessage(conversation.id, user2.id, {
				content: "Second",
				createdAt: new Date(baseTime.getTime() - 1000),
			});
			await createTestMessage(conversation.id, user1.id, {
				content: "Third",
				createdAt: baseTime,
			});

			const messages = await MessageService.getMessages(
				conversation.id,
				user1.id,
			);

			expect(messages).toHaveLength(3);
			expect(messages[0].content).toBe("First");
			expect(messages[1].content).toBe("Second");
			expect(messages[2].content).toBe("Third");
		});

		it("should return empty array if user is not a participant", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const outsider = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			await createTestMessage(conversation.id, user1.id, { content: "Hello" });

			const messages = await MessageService.getMessages(
				conversation.id,
				outsider.id,
			);

			expect(messages).toHaveLength(0);
		});

		it("should not return deleted messages", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			await createTestMessage(conversation.id, user1.id, { content: "Visible" });
			const deletedMsg = await createTestMessage(conversation.id, user1.id, {
				content: "Deleted",
			});

			// Soft delete the message
			await prisma.message.update({
				where: { id: deletedMsg.id },
				data: { deletedAt: new Date() },
			});

			const messages = await MessageService.getMessages(
				conversation.id,
				user1.id,
			);

			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe("Visible");
		});
	});

	describe("editMessage", () => {
		it("should allow sender to edit their own message", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const message = await createTestMessage(conversation.id, user1.id, {
				content: "Original",
			});

			const edited = await MessageService.editMessage(
				message.id,
				user1.id,
				"Edited content",
			);

			expect(edited).not.toBeNull();
			expect(edited!.content).toBe("Edited content");
			expect(edited!.isEdited).toBe(true);
		});

		it("should not allow other users to edit the message", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const message = await createTestMessage(conversation.id, user1.id, {
				content: "Original",
			});

			const result = await MessageService.editMessage(
				message.id,
				user2.id,
				"Hacked!",
			);

			expect(result).toBeNull();

			// Verify message unchanged
			const unchanged = await prisma.message.findUnique({
				where: { id: message.id },
			});
			expect(unchanged!.content).toBe("Original");
		});
	});

	describe("deleteMessage", () => {
		it("should soft delete a message by the sender", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const message = await createTestMessage(conversation.id, user1.id, {
				content: "To be deleted",
			});

			const result = await MessageService.deleteMessage(message.id, user1.id);

			expect(result).toBe(true);

			// Verify soft deleted
			const deleted = await prisma.message.findUnique({
				where: { id: message.id },
			});
			expect(deleted!.deletedAt).not.toBeNull();
		});

		it("should not allow other users to delete the message", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const message = await createTestMessage(conversation.id, user1.id, {
				content: "Not your message",
			});

			const result = await MessageService.deleteMessage(message.id, user2.id);

			expect(result).toBe(false);

			// Verify not deleted
			const notDeleted = await prisma.message.findUnique({
				where: { id: message.id },
			});
			expect(notDeleted!.deletedAt).toBeNull();
		});
	});

	describe("markAsRead", () => {
		it("should update lastReadAt for the participant", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			const beforeMark = new Date();
			await new Promise((resolve) => setTimeout(resolve, 10));

			await MessageService.markAsRead(conversation.id, user1.id);

			const participant = await prisma.conversationParticipant.findFirst({
				where: { conversationId: conversation.id, userId: user1.id },
			});

			expect(participant!.lastReadAt).not.toBeNull();
			expect(participant!.lastReadAt!.getTime()).toBeGreaterThan(
				beforeMark.getTime(),
			);
		});
	});

	describe("getUserConversations", () => {
		it("should return conversations for a user with unread counts", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			// User2 sends messages
			await createTestMessage(conversation.id, user2.id, { content: "Hello" });
			await createTestMessage(conversation.id, user2.id, { content: "Hi again" });

			const conversations = await MessageService.getUserConversations(user1.id);

			expect(conversations).toHaveLength(1);
			expect(conversations[0].unreadCount).toBe(2);
		});

		it("should not count own messages as unread", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();
			const conversation = await createTestConversation([user1.id, user2.id]);

			// User1 sends messages to themselves (shouldn't count as unread)
			await createTestMessage(conversation.id, user1.id, { content: "My own msg" });

			const conversations = await MessageService.getUserConversations(user1.id);

			expect(conversations).toHaveLength(1);
			expect(conversations[0].unreadCount).toBe(0);
		});
	});

	describe("searchUsers", () => {
		it("should find users by username", async () => {
			const currentUser = await createTestUser({ username: "currentuser" });
			await createTestUser({ username: "findme123" });
			await createTestUser({ username: "notmatch" });

			const results = await MessageService.searchUsers("findme", currentUser.id);

			expect(results).toHaveLength(1);
			expect(results[0].username).toBe("findme123");
		});

		it("should not include current user in results", async () => {
			const currentUser = await createTestUser({ username: "myself" });

			const results = await MessageService.searchUsers("myself", currentUser.id);

			expect(results).toHaveLength(0);
		});

		it("should only find verified users", async () => {
			const currentUser = await createTestUser();
			await createTestUser({ username: "verified", emailVerified: true });
			await createTestUser({ username: "unverified", emailVerified: false });

			const results = await MessageService.searchUsers("verified", currentUser.id);

			expect(results).toHaveLength(1);
			expect(results[0].username).toBe("verified");
		});
	});

	describe("getConversationDisplayName", () => {
		it("should return group name for group conversations", async () => {
			const user1 = await createTestUser();
			const user2 = await createTestUser();

			const conversation = await MessageService.createGroupConversation(
				"My Group Chat",
				user1.id,
				[user2.id],
			);

			const convWithDetails = await MessageService.getConversation(
				conversation.id,
				user1.id,
			);

			const displayName = MessageService.getConversationDisplayName(
				convWithDetails!,
				user1.id,
			);

			expect(displayName).toBe("My Group Chat");
		});

		it("should return other user's name for DM conversations", async () => {
			const user1 = await createTestUser({ username: "alice" });
			const user2 = await createTestUser({ username: "bob" });

			const conversation = await MessageService.getOrCreateDirectConversation(
				user1.id,
				user2.id,
			);

			const convWithDetails = await MessageService.getConversation(
				conversation.id,
				user1.id,
			);

			const displayName = MessageService.getConversationDisplayName(
				convWithDetails!,
				user1.id,
			);

			expect(displayName).toBe("bob");
		});
	});
});
