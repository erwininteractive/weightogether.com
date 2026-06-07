import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import bcrypt from "bcrypt";

// Unit system options
export const UNIT_SYSTEMS = [
	{ value: "IMPERIAL", label: "Imperial (lbs, ft)" },
	{ value: "METRIC", label: "Metric (kg, cm)" },
];

/**
 * Controller for user settings management
 */
export class SettingsController {
	/**
	 * Validation rules for preferences update
	 */
	static preferencesValidation = [
		body("unitSystem")
			.isIn(["IMPERIAL", "METRIC"])
			.withMessage("Invalid unit system"),
		// Note: profilePublic and weightVisible are checkboxes that send "on" or are absent
		// The controller handles the transformation to boolean
	];

	/**
	 * Validation rules for password change
	 */
	static passwordValidation = [
		body("currentPassword")
			.notEmpty()
			.withMessage("Current password is required"),
		body("newPassword")
			.isLength({ min: 8 })
			.withMessage("New password must be at least 8 characters")
			.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
			.withMessage(
				"New password must contain at least one uppercase letter, one lowercase letter, and one number",
			),
		body("confirmPassword")
			.custom((value, { req }) => value === req.body.newPassword)
			.withMessage("Passwords do not match"),
	];

	/**
	 * GET /settings
	 * Render settings page
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

			res.render("settings/index", {
				title: "Settings",
				user,
				unitSystems: UNIT_SYSTEMS,
				errors: [],
				success: req.query.success || null,
				error: req.query.error || null,
				section: req.query.section || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /settings/preferences
	 * Update user preferences
	 */
	static async updatePreferences(
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
				res.redirect(
					"/settings?error=" +
						encodeURIComponent(errors.array()[0].msg) +
						"&section=preferences",
				);
				return;
			}

			const { unitSystem, profilePublic, weightVisible } = req.body;

			await prisma.user.update({
				where: { id: userId },
				data: {
					unitSystem,
					profilePublic:
						profilePublic === "on" || profilePublic === "true",
					weightVisible:
						weightVisible === "on" || weightVisible === "true",
				},
			});

			res.redirect(
				"/settings?success=" +
					encodeURIComponent("Preferences updated successfully!") +
					"&section=preferences",
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /settings/password
	 * Change user password
	 */
	static async changePassword(
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
				res.redirect(
					"/settings?error=" +
						encodeURIComponent(errors.array()[0].msg) +
						"&section=security",
				);
				return;
			}

			const { currentPassword, newPassword } = req.body;

			// Check if user has a password (social auth users may not)
			if (!user.passwordHash) {
				res.redirect(
					"/settings?error=" +
						encodeURIComponent(
							"You signed up with social login. Set a password first.",
						) +
						"&section=security",
				);
				return;
			}

			// Verify current password
			const isValid = await bcrypt.compare(
				currentPassword,
				user.passwordHash,
			);

			if (!isValid) {
				res.redirect(
					"/settings?error=" +
						encodeURIComponent("Current password is incorrect") +
						"&section=security",
				);
				return;
			}

			// Hash new password and update
			const passwordHash = await bcrypt.hash(newPassword, 10);

			await prisma.user.update({
				where: { id: userId },
				data: { passwordHash },
			});

			res.redirect(
				"/settings?success=" +
					encodeURIComponent("Password changed successfully!") +
					"&section=security",
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /settings/delete-account
	 * Delete user account
	 */
	static async deleteAccount(
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

			const { confirmPassword } = req.body;

			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				res.redirect("/login");
				return;
			}

			// Verify password before deletion (social auth users need to use a linked social account)
			if (!user.passwordHash) {
				res.redirect(
					"/settings?error=" +
						encodeURIComponent(
							"You signed up with social login. Please set a password first to delete your account.",
						) +
						"&section=danger",
				);
				return;
			}

			const isValid = await bcrypt.compare(
				confirmPassword,
				user.passwordHash,
			);

			if (!isValid) {
				res.redirect(
					"/settings?error=" +
						encodeURIComponent(
							"Incorrect password. Account not deleted.",
						) +
						"&section=danger",
				);
				return;
			}

			// Delete the user (cascades to related records due to schema)
			await prisma.user.delete({
				where: { id: userId },
			});

			// Clear auth cookie and redirect
			res.clearCookie("token");
			res.redirect(
				"/?message=" +
					encodeURIComponent("Account deleted successfully."),
			);
		} catch (error) {
			next(error);
		}
	}
}
