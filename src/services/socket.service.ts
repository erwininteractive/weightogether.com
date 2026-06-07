import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { AuthService } from "./auth.service";

/**
 * Socket.io Service for real-time notifications
 *
 * Handles:
 * - User authentication via JWT
 * - Mapping users to socket connections
 * - Broadcasting notifications to specific users
 */
export class SocketService {
	private static io: Server | null = null;
	private static userSockets: Map<string, Set<string>> = new Map();

	/**
	 * Initialize Socket.io server
	 */
	static initialize(httpServer: HttpServer): Server {
		this.io = new Server(httpServer, {
			cors: {
				origin: process.env.APP_URL || "http://localhost:3000",
				credentials: true,
			},
		});

		this.io.on("connection", (socket: Socket) => {
			this.handleConnection(socket);
		});

		console.log("Socket.io server initialized");
		return this.io;
	}

	/**
	 * Get Socket.io instance
	 */
	static getIO(): Server | null {
		return this.io;
	}

	/**
	 * Handle new socket connection
	 */
	private static handleConnection(socket: Socket): void {
		// Get userId from handshake auth (sent by client during connection)
		const userId = socket.handshake.auth?.userId as string | undefined;

		if (userId) {
			// Add socket to user's set of connections
			if (!this.userSockets.has(userId)) {
				this.userSockets.set(userId, new Set());
			}
			this.userSockets.get(userId)!.add(socket.id);

			// Join user-specific room
			socket.join(`user:${userId}`);

			socket.emit("authenticated", { success: true });
			console.log(`User ${userId} connected (socket: ${socket.id})`);
		}

		// Also support legacy token-based auth
		socket.on("authenticate", async (token: string) => {
			try {
				const payload = AuthService.verifyAccessToken(token);
				const authUserId = payload.sub;

				// Add socket to user's set of connections
				if (!this.userSockets.has(authUserId)) {
					this.userSockets.set(authUserId, new Set());
				}
				this.userSockets.get(authUserId)!.add(socket.id);

				// Join user-specific room
				socket.join(`user:${authUserId}`);

				socket.emit("authenticated", { success: true });
				console.log(
					`User ${authUserId} connected via token (socket: ${socket.id})`
				);
			} catch (error) {
				socket.emit("authenticated", {
					success: false,
					error: "Invalid token",
				});
			}
		});

		// Handle disconnection
		socket.on("disconnect", () => {
			if (userId) {
				const userSocketSet = this.userSockets.get(userId);
				if (userSocketSet) {
					userSocketSet.delete(socket.id);
					if (userSocketSet.size === 0) {
						this.userSockets.delete(userId);
					}
				}
				console.log(
					`User ${userId} disconnected (socket: ${socket.id})`
				);
			}
		});

		// Handle marking messages as read
		socket.on("markAsRead", (conversationId: string) => {
			if (userId) {
				// This could trigger database update if needed
				socket.to(`user:${userId}`).emit("conversationRead", {
					conversationId,
				});
			}
		});
	}

	/**
	 * Check if a user is online
	 */
	static isUserOnline(userId: string): boolean {
		return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
	}

	/**
	 * Get online user IDs
	 */
	static getOnlineUsers(): string[] {
		return Array.from(this.userSockets.keys());
	}

	/**
	 * Send notification to a specific user
	 */
	static notifyUser(
		userId: string,
		event: string,
		data: Record<string, unknown>
	): void {
		if (!this.io) return;

		this.io.to(`user:${userId}`).emit(event, data);
	}

	/**
	 * Send notification to multiple users
	 */
	static notifyUsers(
		userIds: string[],
		event: string,
		data: Record<string, unknown>
	): void {
		if (!this.io) return;

		userIds.forEach((userId) => {
			this.io!.to(`user:${userId}`).emit(event, data);
		});
	}

	/**
	 * Notify about a new message
	 */
	static notifyNewMessage(
		recipientIds: string[],
		message: {
			id: string;
			conversationId: string;
			content: string;
			sender: {
				id: string;
				username: string;
				avatarUrl: string | null;
			};
			createdAt: Date;
		},
		conversationName: string
	): void {
		// Don't notify the sender
		const recipients = recipientIds.filter(
			(id) => id !== message.sender.id
		);

		this.notifyUsers(recipients, "newMessage", {
			message,
			conversationName,
		});
	}

	/**
	 * Notify when typing (optional, for future use)
	 */
	static notifyTyping(
		conversationId: string,
		userIds: string[],
		typingUser: { id: string; username: string }
	): void {
		const recipients = userIds.filter((id) => id !== typingUser.id);

		this.notifyUsers(recipients, "userTyping", {
			conversationId,
			user: typingUser,
		});
	}
}
