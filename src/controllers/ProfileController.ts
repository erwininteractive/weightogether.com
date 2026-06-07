import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import fs from "fs";
import path from "path";

// Enum values for the form
export const UNIT_SYSTEMS = [
	{ value: "IMPERIAL", label: "Imperial (lbs, ft)" },
	{ value: "METRIC", label: "Metric (kg, cm)" },
];

export const GENDERS = [
	{ value: "MALE", label: "Male" },
	{ value: "FEMALE", label: "Female" },
	{ value: "OTHER", label: "Other" },
	{ value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

export const ACTIVITY_LEVELS = [
	{ value: "SEDENTARY", label: "Sedentary (little or no exercise)" },
	{ value: "LIGHTLY_ACTIVE", label: "Lightly Active (1-3 days/week)" },
	{ value: "MODERATELY_ACTIVE", label: "Moderately Active (3-5 days/week)" },
	{ value: "VERY_ACTIVE", label: "Very Active (6-7 days/week)" },
	{ value: "EXTREMELY_ACTIVE", label: "Extremely Active (twice per day)" },
];

/**
 * Controller for user profile management
 */
export class ProfileController {
	/**
	 * Validation rules for profile update
	 */
	static updateValidation = [
		body("displayName")
			.optional({ checkFalsy: true })
			.trim()
			.isLength({ max: 100 })
			.withMessage("Display name must be less than 100 characters"),
		body("bio")
			.optional({ checkFalsy: true })
			.trim()
			.isLength({ max: 500 })
			.withMessage("Bio must be less than 500 characters"),
		body("unitSystem")
			.isIn(["IMPERIAL", "METRIC"])
			.withMessage("Invalid unit system"),
		body("currentWeight")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 1000 })
			.withMessage("Current weight must be between 0 and 1000"),
		body("goalWeight")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 1000 })
			.withMessage("Goal weight must be between 0 and 1000"),
		body("height")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 300 })
			.withMessage("Height must be between 0 and 300"),
		body("gender")
			.optional({ checkFalsy: true })
			.isIn(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY", ""])
			.withMessage("Invalid gender"),
		body("activityLevel")
			.optional({ checkFalsy: true })
			.isIn([
				"SEDENTARY",
				"LIGHTLY_ACTIVE",
				"MODERATELY_ACTIVE",
				"VERY_ACTIVE",
				"EXTREMELY_ACTIVE",
				"",
			])
			.withMessage("Invalid activity level"),
		body("dateOfBirth")
			.optional({ checkFalsy: true })
			.isISO8601()
			.withMessage("Invalid date of birth"),
		body("targetDate")
			.optional({ checkFalsy: true })
			.isISO8601()
			.withMessage("Invalid target date"),
		body("profilePublic")
			.optional()
			.isBoolean()
			.withMessage("Profile public must be a boolean"),
		body("weightVisible")
			.optional()
			.isBoolean()
			.withMessage("Weight visible must be a boolean"),
	];

	/**
	 * GET /profile/edit
	 * Render edit profile page
	 */
	static async edit(
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

			res.render("profile/edit", {
				title: "Edit Profile",
				user,
				unitSystems: UNIT_SYSTEMS,
				genders: GENDERS,
				activityLevels: ACTIVITY_LEVELS,
				errors: [],
				success: req.query.success || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /profile/edit
	 * Handle profile update form submission
	 */
	static async update(
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

			const errors = validationResult(req);

			// Get current user for re-rendering form on error
			const currentUser = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!currentUser) {
				res.redirect("/login");
				return;
			}

			if (!errors.isEmpty()) {
				res.redirect(
					"/profile/edit?error=" +
						encodeURIComponent(errors.array()[0].msg),
				);
				return;
			}

			const {
				displayName,
				bio,
				unitSystem,
				currentWeight,
				goalWeight,
				height,
				gender,
				activityLevel,
				dateOfBirth,
				targetDate,
				profilePublic,
				weightVisible,
			} = req.body;

			// Handle avatar upload
			const file = (req as unknown as { file?: { filename: string } })
				.file;
			let avatarUrl = currentUser.avatarUrl;

			if (file) {
				// Delete old avatar if it exists
				if (currentUser.avatarUrl) {
					const oldAvatarPath = path.join(
						__dirname,
						"../../public",
						currentUser.avatarUrl,
					);
					if (fs.existsSync(oldAvatarPath)) {
						fs.unlinkSync(oldAvatarPath);
					}
				}
				// Set new avatar URL
				avatarUrl = `/uploads/avatars/${file.filename}`;
			}

			// Update user profile
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: {
					displayName: displayName || null,
					bio: bio || null,
					unitSystem,
					currentWeight: currentWeight
						? parseFloat(currentWeight)
						: null,
					goalWeight: goalWeight ? parseFloat(goalWeight) : null,
					height: height ? parseFloat(height) : null,
					gender: gender || null,
					activityLevel: activityLevel || null,
					dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
					targetDate: targetDate ? new Date(targetDate) : null,
					profilePublic:
						profilePublic === "on" || profilePublic === "true",
					weightVisible:
						weightVisible === "on" || weightVisible === "true",
					avatarUrl,
				},
			});

			// Update res.locals.user so the navbar reflects changes immediately
			res.locals.user = updatedUser;

			// Redirect with success message
			res.redirect(
				"/profile/edit?success=" +
					encodeURIComponent("Profile updated successfully!"),
			);
		} catch (error) {
			next(error);
		}
	}
}
