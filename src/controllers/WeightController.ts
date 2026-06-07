import { Response, NextFunction } from "express";
import { validationResult, body } from "express-validator";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";
import { EntryVisibility } from "@prisma/client";
import fs from "fs";
import path from "path";
import { AchievementService } from "../services/achievement.service";

// Visibility options
export const VISIBILITY_OPTIONS = [
	{ value: "PRIVATE", label: "Private (Only me)" },
	{ value: "TEAM", label: "Team members" },
	{ value: "PUBLIC", label: "Public" },
];

// Photo visibility options (same as entry visibility)
export const PHOTO_VISIBILITY_OPTIONS = VISIBILITY_OPTIONS;

/**
 * Controller for weight tracking
 */
export class WeightController {
	/**
	 * Validation rules for weight entry
	 */
	static entryValidation = [
		body("weight")
			.notEmpty()
			.withMessage("Weight is required")
			.isFloat({ min: 0.1, max: 1000 })
			.withMessage("Weight must be between 0.1 and 1000"),
		body("recordedAt")
			.notEmpty()
			.withMessage("Date is required")
			.isISO8601()
			.withMessage("Invalid date"),
		body("notes")
			.optional({ checkFalsy: true })
			.trim()
			.isLength({ max: 1000 })
			.withMessage("Notes must be less than 1000 characters"),
		body("bodyFatPercentage")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 100 })
			.withMessage("Body fat percentage must be between 0 and 100"),
		body("muscleMass")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 500 })
			.withMessage("Muscle mass must be between 0 and 500"),
		body("waterPercentage")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0, max: 100 })
			.withMessage("Water percentage must be between 0 and 100"),
		body("visibility")
			.optional()
			.isIn(["PRIVATE", "TEAM", "PUBLIC"])
			.withMessage("Invalid visibility"),
	];

	/**
	 * GET /progress
	 * Display weight progress with chart and entries list
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

			// Get all weight entries for chart and list (include photos relation)
			const entries = await prisma.weightEntry.findMany({
				where: { userId },
				orderBy: { recordedAt: "desc" },
				include: {
					photos: {
						orderBy: { sortOrder: "asc" },
					},
				},
			});

			// Prepare chart data (sorted by date ascending for the chart)
			const chartData = [...entries]
				.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
				.map((entry) => ({
					date: entry.recordedAt.toISOString().split("T")[0],
					weight: entry.weight,
				}));

			// Calculate stats
			const stats = {
				totalEntries: entries.length,
				startWeight:
					entries.length > 0
						? entries[entries.length - 1].weight
						: null,
				currentWeight: entries.length > 0 ? entries[0].weight : null,
				lowestWeight:
					entries.length > 0
						? Math.min(...entries.map((e) => e.weight))
						: null,
				highestWeight:
					entries.length > 0
						? Math.max(...entries.map((e) => e.weight))
						: null,
				totalChange:
					entries.length > 1
						? entries[0].weight - entries[entries.length - 1].weight
						: null,
			};

			res.render("weight/index", {
				title: "Weight Progress",
				user,
				entries,
				chartData: JSON.stringify(chartData),
				stats,
				success: req.query.success || null,
				error: req.query.error || null,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /progress/log
	 * Display form to log new weight entry
	 */
	static async logForm(
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

			// Check if editing existing entry
			const entryId = req.query.edit as string;
			let entry = null;

			if (entryId) {
				entry = await prisma.weightEntry.findFirst({
					where: { id: entryId, userId },
					include: {
						photos: {
							orderBy: { sortOrder: "asc" },
						},
					},
				});
			}

			res.render("weight/log", {
				title: entry ? "Edit Weight Entry" : "Log Weight",
				user,
				entry,
				visibilityOptions: VISIBILITY_OPTIONS,
				errors: [],
				formData: entry || {
					recordedAt: new Date().toISOString().split("T")[0],
				},
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /progress/log
	 * Create or update weight entry
	 */
	static async logSubmit(
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
			const entryId = req.body.entryId as string;

			if (!errors.isEmpty()) {
				// Get existing entry if editing
				let entry = null;
				if (entryId) {
					entry = await prisma.weightEntry.findFirst({
						where: { id: entryId, userId },
					});
				}

				res.render("weight/log", {
					title: entryId ? "Edit Weight Entry" : "Log Weight",
					user,
					entry,
					visibilityOptions: VISIBILITY_OPTIONS,
					errors: errors.array(),
					formData: req.body,
				});
				return;
			}

			const {
				weight,
				recordedAt,
				notes,
				bodyFatPercentage,
				muscleMass,
				waterPercentage,
				visibility,
				photoVisibility,
			} = req.body;

			// Handle uploaded files
			const files = (req as unknown as { files?: { filename: string }[] })
				.files;

			const entryData = {
				weight: parseFloat(weight),
				recordedAt: new Date(recordedAt),
				notes: notes || null,
				bodyFatPercentage: bodyFatPercentage
					? parseFloat(bodyFatPercentage)
					: null,
				muscleMass: muscleMass ? parseFloat(muscleMass) : null,
				waterPercentage: waterPercentage
					? parseFloat(waterPercentage)
					: null,
				visibility: visibility || "PRIVATE",
			};

			let savedEntryId: string;

			if (entryId) {
				// Update existing entry
				await prisma.weightEntry.update({
					where: { id: entryId },
					data: entryData,
				});
				savedEntryId = entryId;
			} else {
				// Create new entry
				const newEntry = await prisma.weightEntry.create({
					data: {
						...entryData,
						userId,
					},
				});
				savedEntryId = newEntry.id;
			}

			// Create ProgressPhoto records for uploaded files
			if (files && files.length > 0) {
				const existingPhotos = await prisma.progressPhoto.findMany({
					where: { entryId: savedEntryId },
					orderBy: { sortOrder: "desc" },
					take: 1,
				});
				const maxSortOrder =
					existingPhotos.length > 0
						? existingPhotos[0].sortOrder + 1
						: 0;

				await prisma.progressPhoto.createMany({
					data: files.map((file, index) => ({
						entryId: savedEntryId,
						url: `/uploads/progress/${file.filename}`,
						visibility:
							(photoVisibility as EntryVisibility) ||
							visibility ||
							"PRIVATE",
						sortOrder: maxSortOrder + index,
					})),
				});
			}

			// Update user's current weight if this is the most recent entry
			const latestEntry = await prisma.weightEntry.findFirst({
				where: { userId },
				orderBy: { recordedAt: "desc" },
			});

			if (latestEntry) {
				await prisma.user.update({
					where: { id: userId },
					data: { currentWeight: latestEntry.weight },
				});
			}

			// Check for achievement unlocks (only for new entries, not updates)
			const unlockedAchievements: any[] = [];
			if (!entryId) {
				try {
					const weightAchievements =
						await AchievementService.checkWeightAchievements(userId);
					const streakAchievements =
						await AchievementService.checkStreakAchievements(userId);
					const engagementAchievements =
						await AchievementService.checkEngagementAchievements(userId);
					const hiddenAchievements =
						await AchievementService.checkHiddenAchievements(
							userId,
							entryData.weight,
							entryData.recordedAt
						);

					unlockedAchievements.push(
						...weightAchievements,
						...streakAchievements,
						...engagementAchievements,
						...hiddenAchievements,
					);
				} catch (error) {
					// Log error but don't fail the request
					console.error("Error checking achievements:", error);
				}
			}


			// Build redirect URL with success message and achievements
			let redirectUrl =
				"/progress?success=" +
				encodeURIComponent(
					entryId
						? "Entry updated successfully!"
						: "Weight logged successfully!",
				);

			// Add achievements to redirect if any were unlocked
			if (unlockedAchievements.length > 0) {
				redirectUrl +=
					"&achievements=" +
					encodeURIComponent(JSON.stringify(unlockedAchievements));
			}

			res.redirect(redirectUrl);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /progress/delete/:id
	 * Delete a weight entry
	 */
	static async delete(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const entryId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			// Find and verify ownership
			const entry = await prisma.weightEntry.findFirst({
				where: { id: entryId, userId },
			});

			if (!entry) {
				res.redirect(
					"/progress?error=" + encodeURIComponent("Entry not found."),
				);
				return;
			}

			// Delete associated photos from disk
			for (const photoUrl of entry.photoUrls) {
				const filePath = path.join(__dirname, "../../public", photoUrl);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}

			// Delete the entry
			await prisma.weightEntry.delete({
				where: { id: entryId },
			});

			// Update user's current weight
			const latestEntry = await prisma.weightEntry.findFirst({
				where: { userId },
				orderBy: { recordedAt: "desc" },
			});

			await prisma.user.update({
				where: { id: userId },
				data: { currentWeight: latestEntry?.weight || null },
			});

			res.redirect(
				"/progress?success=" +
					encodeURIComponent("Entry deleted successfully!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /progress/photo/:id
	 * Add photo to existing entry (retroactive upload)
	 */
	static async addPhoto(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const entryId = req.params.id;

			if (!userId) {
				res.redirect("/login");
				return;
			}

			// Find and verify ownership
			const entry = await prisma.weightEntry.findFirst({
				where: { id: entryId, userId },
				include: { photos: true },
			});

			if (!entry) {
				res.redirect(
					"/progress?error=" + encodeURIComponent("Entry not found."),
				);
				return;
			}

			// Handle uploaded files
			const files = (req as unknown as { files?: { filename: string }[] })
				.files;
			const visibility =
				(req.body.photoVisibility as EntryVisibility) || "PRIVATE";

			if (files && files.length > 0) {
				const maxSortOrder =
					entry.photos.length > 0
						? Math.max(...entry.photos.map((p) => p.sortOrder)) + 1
						: 0;

				// Create ProgressPhoto records for each uploaded file
				await prisma.progressPhoto.createMany({
					data: files.map((file, index) => ({
						entryId,
						url: `/uploads/progress/${file.filename}`,
						visibility,
						sortOrder: maxSortOrder + index,
					})),
				});
			}

			res.redirect(
				"/progress?success=" +
					encodeURIComponent("Photo added successfully!"),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /progress/photo/:photoId/visibility
	 * Update photo visibility
	 */
	static async updatePhotoVisibility(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const photoId = req.params.photoId;

			if (!userId) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			// Find photo and verify ownership through entry
			const photo = await prisma.progressPhoto.findUnique({
				where: { id: photoId },
				include: { entry: true },
			});

			if (!photo || photo.entry.userId !== userId) {
				res.status(404).json({ error: "Photo not found" });
				return;
			}

			const visibility = req.body.visibility as EntryVisibility;
			if (!["PRIVATE", "TEAM", "PUBLIC"].includes(visibility)) {
				res.status(400).json({ error: "Invalid visibility" });
				return;
			}

			await prisma.progressPhoto.update({
				where: { id: photoId },
				data: { visibility },
			});

			res.json({ success: true, visibility });
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /photo/:photoId
	 * Delete a photo
	 */
	static async deletePhoto(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;
			const photoId = req.params.photoId;

			if (!userId) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			// Find photo and verify ownership through entry
			const photo = await prisma.progressPhoto.findUnique({
				where: { id: photoId },
				include: { entry: true },
			});

			if (!photo || photo.entry.userId !== userId) {
				res.status(404).json({ error: "Photo not found" });
				return;
			}

			// Delete file from disk
			const filePath = path.join(__dirname, "../../public", photo.url);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}

			// Delete from database
			await prisma.progressPhoto.delete({
				where: { id: photoId },
			});

			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}
}
