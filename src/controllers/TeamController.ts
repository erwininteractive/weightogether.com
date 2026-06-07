import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import { TeamRole } from "@prisma/client";
import crypto from "crypto";
import { AchievementService } from "../services/achievement.service";
import { MessageService } from "../services/message.service";

// Role options for display
export const ROLE_OPTIONS = [
	{ value: "ADMIN", label: "Admin" },
	{ value: "MODERATOR", label: "Moderator" },
	{ value: "MEMBER", label: "Member" },
];

/**
 * Controller for team management
 */
export class TeamController {
	/**
	 * Validation rules for team creation/update
	 */
	static teamValidation = [
		body("name")
			.notEmpty()
			.withMessage("Team name is required")
			.trim()
			.isLength({ min: 3, max: 50 })
			.withMessage("Team name must be between 3 and 50 characters")
			.matches(/^[a-zA-Z0-9\s\-_]+$/)
			.withMessage(
				"Team name can only contain letters, numbers, spaces, hyphens, and underscores",
			),
		body("description")
			.optional({ checkFalsy: true })
			.trim()
			.isLength({ max: 500 })
			.withMessage("Description must be less than 500 characters"),
		body("isPublic")
			.optional()
			.isBoolean()
			.withMessage("Invalid visibility"),
		body("maxMembers")
			.optional()
			.isInt({ min: 2, max: 100 })
			.withMessage("Max members must be between 2 and 100"),
	];

	/**
	 * GET /teams
	 * Display user's teams and discover public teams
	 */
	static async index(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			// Get user's teams (teams they are a member of)
			const myTeams = await prisma.teamMember.findMany({
				where: { userId },
				include: {
					team: {
						include: {
							owner: {
								select: {
									id: true,
									username: true,
									displayName: true,
									avatarUrl: true,
								},
							},
							_count: {
								select: { members: true },
							},
						},
					},
				},
				orderBy: { joinedAt: "desc" },
			});

			// Get public teams the user is not a member of (for discovery)
			const myTeamIds = myTeams.map((tm) => tm.teamId);
			const publicTeams = await prisma.team.findMany({
				where: {
					isPublic: true,
					id: { notIn: myTeamIds },
				},
				include: {
					owner: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
					_count: {
						select: { members: true },
					},
				},
				orderBy: { createdAt: "desc" },
				take: 10,
			});

			res.render("teams/index", {
				title: "My Teams",
				user,
				myTeams,
				publicTeams,
				success: req.query.success || null,
				error: req.query.error || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /teams/create
	 * Display team creation form
	 */
	static async createForm(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			res.render("teams/create", {
				title: "Create Team",
				user,
				errors: [],
				formData: {},
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/create
	 * Create a new team
	 */
	static async create(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				res.render("teams/create", {
					title: "Create Team",
					user,
					errors: errors.array(),
					formData: req.body,
				});
				return;
			}

			const { name, description, isPublic, maxMembers } = req.body;

			// Check if team name already exists
			const existingTeam = await prisma.team.findUnique({
				where: { name: name.trim() },
			});

			if (existingTeam) {
				res.render("teams/create", {
					title: "Create Team",
					user,
					errors: [{ msg: "A team with this name already exists" }],
					formData: req.body,
				});
				return;
			}

			// Create team and add owner as member
			const team = await prisma.team.create({
				data: {
					name: name.trim(),
					description: description?.trim() || null,
					isPublic: isPublic === "true" || isPublic === true,
					maxMembers: maxMembers ? parseInt(maxMembers) : 50,
					ownerId: userId,
					inviteCode: crypto.randomUUID(),
					members: {
						create: {
							userId,
							role: TeamRole.OWNER,
						},
					},
				},
			});

			res.redirect(
				`/teams/${team.id}?success=` +
					encodeURIComponent("Team created successfully!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /teams/:id
	 * Display team details
	 */
	static async show(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			// Get team with members
			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					owner: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
					members: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									displayName: true,
									avatarUrl: true,
									currentWeight: true,
									goalWeight: true,
									unitSystem: true,
									weightVisible: true,
								},
							},
						},
						orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
					},
					_count: {
						select: { members: true, challenges: true },
					},
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Check if user is a member
			const membership = team.members.find((m) => m.userId === userId);
			const isMember = !!membership;
			const isOwner = team.ownerId === userId;
			const isAdmin =
				isOwner ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;
			const isModerator =
				isAdmin || membership?.role === TeamRole.MODERATOR;

			// If team is private and user is not a member, deny access
			if (!team.isPublic && !isMember) {
				res.redirect(
					"/teams?error=" +
						encodeURIComponent(
							"You don't have access to this team.",
						),
				);
				return;
			}


		// Fetch posts for the team feed (only for members)
		let posts: any[] = [];
		if (isMember) {
			posts = await prisma.post.findMany({
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
							comments: { where: { deletedAt: null } },
							likes: true,
						},
					},
					likes: {
						where: { userId },
						select: { id: true },
					},
				},
				orderBy: { createdAt: "desc" },
				take: 20, // Limit to most recent 20 posts
			});

			// Add isLiked property to each post
			posts = posts.map((post) => ({
				...post,
				isLiked: post.likes.length > 0,
			}));
		}
			res.render("teams/show", {
				title: team.name,
				user,
				team,
				membership,
				isMember,
				isOwner,
				isAdmin,
				isModerator,
				roleOptions: ROLE_OPTIONS,
				posts,
				userRole: membership?.role || null,
				success: req.query.success || null,
				error: req.query.error || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /teams/:id/edit
	 * Display team edit form
	 */
	static async editForm(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					members: {
						where: { userId },
					},
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Check if user has permission to edit
			const membership = team.members[0];
			const canEdit =
				team.ownerId === userId ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;

			if (!canEdit) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"You don't have permission to edit this team.",
						),
				);
				return;
			}

			res.render("teams/edit", {
				title: `Edit ${team.name}`,
				user,
				team,
				errors: [],
				formData: team,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/edit
	 * Update team settings
	 */
	static async update(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					members: {
						where: { userId },
					},
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Check if user has permission to edit
			const membership = team.members[0];
			const canEdit =
				team.ownerId === userId ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;

			if (!canEdit) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"You don't have permission to edit this team.",
						),
				);
				return;
			}

			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				res.render("teams/edit", {
					title: `Edit ${team.name}`,
					user,
					team,
					errors: errors.array(),
					formData: req.body,
				});
				return;
			}

			const { name, description, isPublic, maxMembers } = req.body;

			// Check if new name already exists (if changed)
			if (name.trim() !== team.name) {
				const existingTeam = await prisma.team.findUnique({
					where: { name: name.trim() },
				});

				if (existingTeam) {
					res.render("teams/edit", {
						title: `Edit ${team.name}`,
						user,
						team,
						errors: [
							{ msg: "A team with this name already exists" },
						],
						formData: req.body,
					});
					return;
				}
			}

			await prisma.team.update({
				where: { id: teamId },
				data: {
					name: name.trim(),
					description: description?.trim() || null,
					isPublic: isPublic === "true" || isPublic === true,
					maxMembers: maxMembers ? parseInt(maxMembers) : 50,
				},
			});

			res.redirect(
				`/teams/${teamId}?success=` +
					encodeURIComponent("Team updated successfully!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/join
	 * Join a public team
	 */
	static async join(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					_count: { select: { members: true } },
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			if (!team.isPublic) {
				res.redirect(
					"/teams?error=" +
						encodeURIComponent(
							"This team is private. You need an invite code to join.",
						),
				);
				return;
			}

			// Check if already a member
			const existingMembership = await prisma.teamMember.findUnique({
				where: {
					teamId_userId: { teamId, userId },
				},
			});

			if (existingMembership) {
				res.redirect(`/teams/${teamId}`);
				return;
			}

			// Check max members
			if (team._count.members >= team.maxMembers) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("This team is full."),
				);
				return;
			}

			// Join team
			await prisma.teamMember.create({
				data: {
					teamId,
					userId,
					role: TeamRole.MEMBER,
				},
			});

			// Sync team chat participants
			try {
				const teamMembers = await prisma.teamMember.findMany({
					where: { teamId },
					select: { userId: true },
				});
				await MessageService.syncTeamConversationParticipants(
					teamId,
					teamMembers.map((m) => m.userId)
				);
			} catch (error) {
				console.error("Error syncing team chat participants:", error);
			}

			// Check for achievement unlocks
			try {
				await AchievementService.checkEngagementAchievements(userId);
			} catch (error) {
				// Log error but don't fail the request
				console.error("Error checking achievements:", error);
			}

			res.redirect(
				`/teams/${teamId}?success=` +
					encodeURIComponent("You have joined the team!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /teams/join/:code
	 * Join via invite code
	 */
	static async joinViaCode(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const inviteCode = req.params.code;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { inviteCode },
				include: {
					owner: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
					_count: { select: { members: true } },
				},
			});

			if (!team) {
				res.render("teams/join", {
					title: "Join Team",
					user,
					team: null,
					error: "Invalid or expired invite code.",
				});
				return;
			}

			// Check if already a member
			const existingMembership = await prisma.teamMember.findUnique({
				where: {
					teamId_userId: { teamId: team.id, userId },
				},
			});

			if (existingMembership) {
				res.redirect(`/teams/${team.id}`);
				return;
			}

			// Check max members
			if (team._count.members >= team.maxMembers) {
				res.render("teams/join", {
					title: "Join Team",
					user,
					team,
					error: "This team is full.",
				});
				return;
			}

			res.render("teams/join", {
				title: `Join ${team.name}`,
				user,
				team,
				error: null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/join/:code
	 * Confirm joining via invite code
	 */
	static async confirmJoinViaCode(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const inviteCode = req.params.code;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { inviteCode },
				include: {
					_count: { select: { members: true } },
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" +
						encodeURIComponent("Invalid or expired invite code."),
				);
				return;
			}

			// Check if already a member
			const existingMembership = await prisma.teamMember.findUnique({
				where: {
					teamId_userId: { teamId: team.id, userId },
				},
			});

			if (existingMembership) {
				res.redirect(`/teams/${team.id}`);
				return;
			}

			// Check max members
			if (team._count.members >= team.maxMembers) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("This team is full."),
				);
				return;
			}

			// Join team
			await prisma.teamMember.create({
				data: {
					teamId: team.id,
					userId,
					role: TeamRole.MEMBER,
				},
			});

			// Sync team chat participants
			try {
				const teamMembers = await prisma.teamMember.findMany({
					where: { teamId: team.id },
					select: { userId: true },
				});
				await MessageService.syncTeamConversationParticipants(
					team.id,
					teamMembers.map((m) => m.userId)
				);
			} catch (error) {
				console.error("Error syncing team chat participants:", error);
			}

			// Check for achievement unlocks
			try {
				await AchievementService.checkEngagementAchievements(userId);
			} catch (error) {
				// Log error but don't fail the request
				console.error("Error checking achievements:", error);
			}

			res.redirect(
				`/teams/${team.id}?success=` +
					encodeURIComponent("You have joined the team!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/leave
	 * Leave a team
	 */
	static async leave(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Owner cannot leave, they must transfer ownership or delete the team
			if (team.ownerId === userId) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"As the owner, you cannot leave the team. Transfer ownership first or delete the team.",
						),
				);
				return;
			}

			// Remove membership
			await prisma.teamMember.delete({
				where: {
					teamId_userId: { teamId, userId },
				},
			});

			// Sync team chat participants
			try {
				const teamMembers = await prisma.teamMember.findMany({
					where: { teamId },
					select: { userId: true },
				});
				await MessageService.syncTeamConversationParticipants(
					teamId,
					teamMembers.map((m) => m.userId)
				);
			} catch (error) {
				console.error("Error syncing team chat participants:", error);
			}

			res.redirect(
				"/teams?success=" +
					encodeURIComponent("You have left the team."),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/members/:memberId/role
	 * Update member role
	 */
	static async updateMemberRole(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;
			const memberId = req.params.memberId;
			const { role } = req.body;

			if (!userId) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					members: {
						where: { userId },
					},
				},
			});

			if (!team) {
				res.status(404).json({ error: "Team not found" });
				return;
			}

			// Check if user has permission
			const membership = team.members[0];
			const isOwner = team.ownerId === userId;
			const isAdmin =
				isOwner ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;

			if (!isAdmin) {
				res.status(403).json({
					error: "You don't have permission to change roles",
				});
				return;
			}

			// Cannot change owner's role
			const targetMember = await prisma.teamMember.findUnique({
				where: { id: memberId },
			});

			if (!targetMember || targetMember.teamId !== teamId) {
				res.status(404).json({ error: "Member not found" });
				return;
			}

			if (targetMember.userId === team.ownerId) {
				res.status(400).json({ error: "Cannot change owner's role" });
				return;
			}

			// Validate role
			if (!["ADMIN", "MODERATOR", "MEMBER"].includes(role)) {
				res.status(400).json({ error: "Invalid role" });
				return;
			}

			await prisma.teamMember.update({
				where: { id: memberId },
				data: { role: role as TeamRole },
			});

			res.json({ success: true, role });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/members/:memberId/remove
	 * Remove a member from the team
	 */
	static async removeMember(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;
			const memberId = req.params.memberId;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					members: {
						where: { userId },
					},
				},
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Check if user has permission
			const membership = team.members[0];
			const isOwner = team.ownerId === userId;
			const isAdmin =
				isOwner ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;
			const isModerator =
				isAdmin || membership?.role === TeamRole.MODERATOR;

			if (!isModerator) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"You don't have permission to remove members.",
						),
				);
				return;
			}

			// Get target member
			const targetMember = await prisma.teamMember.findUnique({
				where: { id: memberId },
			});

			if (!targetMember || targetMember.teamId !== teamId) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent("Member not found."),
				);
				return;
			}

			// Cannot remove owner
			if (targetMember.userId === team.ownerId) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent("Cannot remove the team owner."),
				);
				return;
			}

			// Moderators can only remove regular members
			if (
				!isAdmin &&
				(targetMember.role === TeamRole.ADMIN ||
					targetMember.role === TeamRole.MODERATOR)
			) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"You don't have permission to remove this member.",
						),
				);
				return;
			}

			await prisma.teamMember.delete({
				where: { id: memberId },
			});

			// Sync team chat participants
			try {
				const teamMembers = await prisma.teamMember.findMany({
					where: { teamId },
					select: { userId: true },
				});
				await MessageService.syncTeamConversationParticipants(
					teamId,
					teamMembers.map((m) => m.userId)
				);
			} catch (error) {
				console.error("Error syncing team chat participants:", error);
			}

			res.redirect(
				`/teams/${teamId}?success=` +
					encodeURIComponent("Member removed successfully."),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/regenerate-invite
	 * Regenerate invite code
	 */
	static async regenerateInvite(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
				include: {
					members: {
						where: { userId },
					},
				},
			});

			if (!team) {
				res.status(404).json({ error: "Team not found" });
				return;
			}

			// Check if user has permission
			const membership = team.members[0];
			const isAdmin =
				team.ownerId === userId ||
				membership?.role === TeamRole.ADMIN ||
				membership?.role === TeamRole.OWNER;

			if (!isAdmin) {
				res.status(403).json({
					error: "You don't have permission to regenerate the invite code",
				});
				return;
			}

			const newCode = crypto.randomUUID();

			await prisma.team.update({
				where: { id: teamId },
				data: { inviteCode: newCode },
			});

			res.json({ success: true, inviteCode: newCode });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:id/delete
	 * Delete a team (owner only)
	 */
	static async delete(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const teamId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			const team = await prisma.team.findUnique({
				where: { id: teamId },
			});

			if (!team) {
				res.redirect(
					"/teams?error=" + encodeURIComponent("Team not found."),
				);
				return;
			}

			// Only owner can delete
			if (team.ownerId !== userId) {
				res.redirect(
					`/teams/${teamId}?error=` +
						encodeURIComponent(
							"Only the team owner can delete the team.",
						),
				);
				return;
			}

			await prisma.team.delete({
				where: { id: teamId },
			});

			res.redirect(
				"/teams?success=" +
					encodeURIComponent("Team deleted successfully."),
			);
		} catch (error) {
			next(error);
		}
	}
}
