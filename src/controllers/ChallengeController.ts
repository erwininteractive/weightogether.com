import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import { ChallengeType, ChallengeStatus } from "@prisma/client";
import { AchievementService } from "../services/achievement.service";

/**
 * Controller for team challenge management
 */
export class ChallengeController {
	/**
	 * Validation rules for challenge creation
	 */
	static challengeValidation = [
		body("name")
			.notEmpty()
			.withMessage("Challenge name is required")
			.trim()
			.isLength({ min: 3, max: 100 })
			.withMessage("Challenge name must be between 3 and 100 characters"),
		body("description")
			.notEmpty()
			.withMessage("Challenge description is required")
			.trim()
			.isLength({ min: 10, max: 1000 })
			.withMessage(
				"Challenge description must be between 10 and 1000 characters",
			),
		body("type")
			.notEmpty()
			.withMessage("Challenge type is required")
			.isIn([
				"WEIGHT_LOSS_PERCENTAGE",
				"TOTAL_WEIGHT_LOSS",
				"CONSISTENCY",
				"ACTIVITY_BASED",
			])
			.withMessage("Invalid challenge type"),
		body("startDate")
			.notEmpty()
			.withMessage("Start date is required")
			.isISO8601()
			.withMessage("Start date must be a valid date"),
		body("endDate")
			.notEmpty()
			.withMessage("End date is required")
			.isISO8601()
			.withMessage("End date must be a valid date")
			.custom((endDate, { req }) => {
				if (new Date(endDate) <= new Date(req.body.startDate)) {
					throw new Error("End date must be after start date");
				}
				return true;
			}),
		body("targetValue")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0 })
			.withMessage("Target value must be a positive number"),
		body("rewardPoints")
			.optional({ checkFalsy: true })
			.isInt({ min: 0 })
			.withMessage("Reward points must be a positive integer"),
	];

	/**
	 * GET /teams/:teamId/challenges
	 * List all challenges for a team
	 */
	static async listTeamChallenges(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { teamId } = req.params;
			const userId = req.user!.sub;

			// Verify user is a team member
			const membership = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId } },
				include: { team: { select: { name: true } } },
			});

			if (!membership) {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "You must be a team member to view challenges",
				});
				return;
			}

			// Get all challenges for the team
			const challenges = await prisma.challenge.findMany({
				where: { teamId },
				include: {
					_count: {
						select: {
							participants: true,
						},
					},
					participants: {
						where: { userId },
						select: { id: true, progress: true, completed: true },
					},
				},
				orderBy: [{ status: "asc" }, { startDate: "desc" }],
			});

			// Add participation status to each challenge
			const challengesWithStatus = challenges.map((challenge) => ({
				...challenge,
				isParticipating: challenge.participants.length > 0,
				userProgress: challenge.participants[0] || null,
			}));

			res.render("challenges/list", {
				title: `${membership.team.name} Challenges`,
				team: { id: teamId, name: membership.team.name },
				challenges: challengesWithStatus,
				userRole: membership.role,
				success: req.query.success || null,
				error: req.query.error || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /teams/:teamId/challenges/new
	 * Show create challenge form
	 */
	static async createForm(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { teamId } = req.params;
			const userId = req.user!.sub;

			// Verify user is a team admin/owner
			const membership = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId } },
				include: { team: { select: { name: true } } },
			});

			if (!membership) {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "You must be a team member",
				});
				return;
			}

			if (!["OWNER", "ADMIN"].includes(membership.role)) {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "Only team admins can create challenges",
				});
				return;
			}

			res.render("challenges/create", {
				title: "Create Challenge",
				team: { id: teamId, name: membership.team.name },
				challengeTypes: Object.values(ChallengeType),
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /teams/:teamId/challenges
	 * Create a new challenge
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

			// Verify user is a team admin/owner
			const membership = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId } },
			});

			if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
				res.status(403).json({
					success: false,
					message: "Only team admins can create challenges",
				});
				return;
			}

			const {
				name,
				description,
				type,
				startDate,
				endDate,
				targetValue,
				rewardPoints,
			} = req.body;

			// Determine status based on dates
			const now = new Date();
			const start = new Date(startDate);
			const end = new Date(endDate);
			let status: ChallengeStatus = "UPCOMING";
			if (now >= start && now <= end) {
				status = "ACTIVE";
			} else if (now > end) {
				status = "COMPLETED";
			}

			// Create challenge
			await prisma.challenge.create({
				data: {
					name,
					description,
					type: type as ChallengeType,
					status,
					startDate: start,
					endDate: end,
					targetValue: targetValue ? parseFloat(targetValue) : null,
					rewardPoints: rewardPoints ? parseInt(rewardPoints) : 0,
					teamId,
				},
			});

			res.redirect(
				`/teams/${teamId}/challenges?success=${encodeURIComponent("Challenge created successfully")}`,
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /challenges/:id
	 * View challenge details and leaderboard
	 */
	static async show(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const challenge = await prisma.challenge.findUnique({
				where: { id },
				include: {
					team: {
						select: {
							id: true,
							name: true,
						},
					},
					participants: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									displayName: true,
									avatarUrl: true,
								},
							},
						},
						orderBy: [
							{ completed: "desc" },
							{ progress: "desc" },
							{ joinedAt: "asc" },
						],
					},
					_count: {
						select: {
							participants: true,
						},
					},
				},
			});

			if (!challenge) {
				res.status(404).render("errors/404", {
					title: "Challenge Not Found",
					message: "The challenge you're looking for doesn't exist",
				});
				return;
			}

			// Verify user is a team member
			if (challenge.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: { teamId: challenge.teamId, userId },
					},
				});

				if (!membership) {
					res.status(403).render("errors/403", {
						title: "Access Denied",
						message:
							"You must be a team member to view this challenge",
					});
					return;
				}
			}

			// Check if current user is participating
			const userParticipation = challenge.participants.find(
				(p) => p.userId === userId,
			);

			res.render("challenges/show", {
				title: challenge.name,
				challenge,
				userParticipation,
				isParticipating: !!userParticipation,
				success: req.query.success || null,
				error: req.query.error || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /challenges/:id/join
	 * Join a challenge
	 */
	static async join(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const challenge = await prisma.challenge.findUnique({
				where: { id },
				select: {
					id: true,
					teamId: true,
					status: true,
					type: true,
					startDate: true,
				},
			});

			if (!challenge) {
				res.status(404).json({
					success: false,
					message: "Challenge not found",
				});
				return;
			}

			// Verify user is a team member
			if (challenge.teamId) {
				const membership = await prisma.teamMember.findUnique({
					where: {
						teamId_userId: { teamId: challenge.teamId, userId },
					},
				});

				if (!membership) {
					res.status(403).json({
						success: false,
						message:
							"You must be a team member to join this challenge",
					});
					return;
				}
			}

			// Check if challenge is active or upcoming
			if (!["UPCOMING", "ACTIVE"].includes(challenge.status)) {
				res.status(400).json({
					success: false,
					message:
						"This challenge is no longer accepting participants",
				});
				return;
			}

			// Check if already participating
			const existing = await prisma.challengeParticipant.findUnique({
				where: { challengeId_userId: { challengeId: id, userId } },
			});

			if (existing) {
				res.status(400).json({
					success: false,
					message: "You are already participating in this challenge",
				});
				return;
			}

			// Create participation
			await prisma.challengeParticipant.create({
				data: {
					challengeId: id,
					userId,
					progress: 0,
				},
			});

			// Check for achievement unlocks
			try {
				await AchievementService.checkEngagementAchievements(userId);
			} catch (error) {
				// Log error but don't fail the request
				console.error("Error checking achievements:", error);
			}

			res.json({
				success: true,
				message: "Successfully joined the challenge!",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /challenges/:id/leave
	 * Leave a challenge
	 */
	static async leave(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;
			const userId = req.user!.sub;

			const participation = await prisma.challengeParticipant.findUnique({
				where: { challengeId_userId: { challengeId: id, userId } },
			});

			if (!participation) {
				res.status(404).json({
					success: false,
					message: "You are not participating in this challenge",
				});
				return;
			}

			await prisma.challengeParticipant.delete({
				where: { id: participation.id },
			});

			res.json({
				success: true,
				message: "Successfully left the challenge",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /challenges/:id/update-progress
	 * Update challenge progress for all participants (called by cron or when weight is logged)
	 */
	static async updateProgress(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { id } = req.params;

			const challenge = await prisma.challenge.findUnique({
				where: { id },
				include: {
					participants: {
						include: {
							user: {
								select: {
									id: true,
									currentWeight: true,
								},
							},
						},
					},
				},
			});

			if (!challenge) {
				res.status(404).json({
					success: false,
					message: "Challenge not found",
				});
				return;
			}

			// Calculate progress based on challenge type
			for (const participant of challenge.participants) {
				let progress = 0;

				switch (challenge.type) {
					case "WEIGHT_LOSS_PERCENTAGE":
					case "TOTAL_WEIGHT_LOSS":
						progress =
							await ChallengeController.calculateWeightLossProgress(
								participant.userId,
								challenge,
							);
						break;

					case "CONSISTENCY":
						progress =
							await ChallengeController.calculateConsistencyProgress(
								participant.userId,
								challenge,
							);
						break;

					case "ACTIVITY_BASED":
						// This would integrate with activity tracking if implemented
						progress = 0;
						break;
				}

				// Update participant progress
				const completed: boolean = !!(
					challenge.targetValue && progress >= challenge.targetValue
				);

				await prisma.challengeParticipant.update({
					where: { id: participant.id },
					data: {
						progress,
						completed,
						completedAt:
							completed && !participant.completedAt
								? new Date()
								: participant.completedAt,
					},
				});
			}

			res.json({
				success: true,
				message: "Progress updated successfully",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Helper: Calculate weight loss progress
	 */
	private static async calculateWeightLossProgress(
		userId: string,
		challenge: { startDate: Date; endDate: Date; type: ChallengeType },
	): Promise<number> {
		// Get weight at challenge start
		const startWeight = await prisma.weightEntry.findFirst({
			where: {
				userId,
				recordedAt: {
					lte: challenge.startDate,
				},
			},
			orderBy: { recordedAt: "desc" },
		});

		// Get latest weight during challenge
		const latestWeight = await prisma.weightEntry.findFirst({
			where: {
				userId,
				recordedAt: {
					gte: challenge.startDate,
					lte: new Date(), // Don't count future entries
				},
			},
			orderBy: { recordedAt: "desc" },
		});

		if (!startWeight || !latestWeight) {
			return 0;
		}

		const weightLost = startWeight.weight - latestWeight.weight;

		if (challenge.type === "WEIGHT_LOSS_PERCENTAGE") {
			return (weightLost / startWeight.weight) * 100;
		}

		return weightLost;
	}

	/**
	 * Helper: Calculate consistency progress
	 */
	private static async calculateConsistencyProgress(
		userId: string,
		challenge: { startDate: Date; endDate: Date },
	): Promise<number> {
		const entries = await prisma.weightEntry.count({
			where: {
				userId,
				recordedAt: {
					gte: challenge.startDate,
					lte: new Date(),
				},
			},
		});

		return entries;
	}
}
