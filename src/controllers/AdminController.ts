import { Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import { AuthService } from "../services/auth.service";

/**
 * Controller for admin user management
 */
export class AdminController {
	/**
	 * GET /admin/users
	 * List all users with pagination
	 */
	static async listUsers(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = 50;
			const skip = (page - 1) * limit;

			const [users, totalCount] = await Promise.all([
				prisma.user.findMany({
					select: {
						id: true,
						email: true,
						username: true,
						displayName: true,
						isActive: true,
						isAdmin: true,
						emailVerified: true,
						lastLoginAt: true,
						createdAt: true,
						_count: {
							select: {
								weightEntries: true,
								teamMemberships: true,
								posts: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
					skip,
					take: limit,
				}),
				prisma.user.count(),
			]);

			const totalPages = Math.ceil(totalCount / limit);

			res.render("admin/users/list", {
				title: "User Management",
				users,
				currentPage: page,
				totalPages,
				totalCount,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /admin/users/:userId
	 * View detailed user information
	 */
	static async viewUser(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { userId } = req.params;

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					email: true,
					username: true,
					displayName: true,
					avatarUrl: true,
					bio: true,
					isActive: true,
					isAdmin: true,
					emailVerified: true,
					lastLoginAt: true,
					createdAt: true,
					updatedAt: true,
					unitSystem: true,
					currentWeight: true,
					goalWeight: true,
					height: true,
					dateOfBirth: true,
					_count: {
						select: {
							weightEntries: true,
							teamMemberships: true,
							ownedTeams: true,
							posts: true,
							comments: true,
						},
					},
					teamMemberships: {
						select: {
							role: true,
							joinedAt: true,
							team: {
								select: {
									id: true,
									name: true,
								},
							},
						},
						orderBy: { joinedAt: "desc" },
						take: 10,
					},
				},
			});

			if (!user) {
				res.status(404).render("errors/404", {
					title: "User Not Found",
					message: "The user you're looking for doesn't exist",
				});
				return;
			}

			res.render("admin/users/view", {
				title: `User: ${user.username}`,
				viewedUser: user,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /admin/users/:userId/reset-password
	 * Reset a user's password
	 */
	static resetPasswordValidation = [
		body("newPassword")
			.notEmpty()
			.withMessage("New password is required")
			.isLength({ min: 8 })
			.withMessage("Password must be at least 8 characters")
			.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
			.withMessage(
				"Password must contain at least one uppercase letter, one lowercase letter, and one number",
			),
	];

	static async resetPassword(
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

			const { userId } = req.params;
			const { newPassword } = req.body;

			// Verify user exists
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { id: true, username: true, email: true },
			});

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			// Hash new password
			const passwordHash = await AuthService.hashPassword(newPassword);

			// Update password
			await prisma.user.update({
				where: { id: userId },
				data: { passwordHash },
			});

			// Invalidate all refresh tokens for security
			await prisma.refreshToken.deleteMany({
				where: { userId },
			});

			res.json({
				success: true,
				message: `Password reset successfully for ${user.username}. User will need to log in again.`,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /admin/users/:userId/toggle-admin
	 * Toggle admin status for a user
	 */
	static async toggleAdmin(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { userId } = req.params;
			const adminUserId = req.user!.sub;

			// Prevent users from removing their own admin status
			if (userId === adminUserId) {
				res.status(404).json({
					success: false,
					message: "You cannot modify your own admin status",
				});
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { id: true, username: true, isAdmin: true },
			});

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: { isAdmin: !user.isAdmin },
				select: { isAdmin: true },
			});

			res.json({
				success: true,
				message: `${user.username} is ${updatedUser.isAdmin ? "now" : "no longer"} an administrator`,
				isAdmin: updatedUser.isAdmin,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /admin/users/:userId/toggle-active
	 * Toggle active status for a user
	 */
	static async toggleActive(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { userId } = req.params;
			const adminUserId = req.user!.sub;

			// Prevent users from deactivating themselves
			if (userId === adminUserId) {
				res.status(404).json({
					success: false,
					message: "You cannot deactivate your own account",
				});
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { id: true, username: true, isActive: true },
			});

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: { isActive: !user.isActive },
				select: { isActive: true },
			});

			// If deactivating, invalidate all refresh tokens
			if (!updatedUser.isActive) {
				await prisma.refreshToken.deleteMany({
					where: { userId },
				});
			}

			res.json({
				success: true,
				message: `${user.username} account is now ${updatedUser.isActive ? "active" : "deactivated"}`,
				isActive: updatedUser.isActive,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /admin/users/:userId/delete
	 * Permanently delete a user and all their data
	 */
	static async deleteUser(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { userId } = req.params;
			const adminUserId = req.user!.sub;

			// Prevent users from deleting themselves
			if (userId === adminUserId) {
				res.status(400).json({
					success: false,
					message:
						"You cannot delete your own account from the admin panel",
				});
				return;
			}

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					email: true,
					isAdmin: true,
				},
			});

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			// Prevent deleting other admins (extra safety)
			if (user.isAdmin) {
				res.status(400).json({
					success: false,
					message:
						"Cannot delete an admin user. Remove admin status first.",
				});
				return;
			}

			// Delete the user - cascading deletes will handle related records
			await prisma.user.delete({
				where: { id: userId },
			});

			res.json({
				success: true,
				message: `User ${user.username} (${user.email}) has been permanently deleted`,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /admin/users/:userId/resend-verification
	 * Resend verification email for a user
	 */
	static async resendVerification(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { userId } = req.params;

			const user = await prisma.user.findFirst({
				where: { id: userId, deletedAt: null },
				select: {
					id: true,
					email: true,
					emailVerified: true,
					username: true,
				},
			});

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			if (user.emailVerified) {
				res.status(400).json({
					success: false,
					message: "Email is already verified",
				});
				return;
			}

			await AuthService.resendVerificationEmail(user.email);

			res.json({
				success: true,
				message: `Verification email sent to ${user.email}`,
			});
		} catch (error) {
			next(error);
		}
	}
}
