import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { emailService } from "../services/email.service";

export class FeedbackController {
	/**
	 * Validation rules for feedback submission
	 */
	static submitValidation = [
		body("type")
			.isIn(["bug", "feature", "question", "other"])
			.withMessage("Please select a valid feedback type"),
		body("subject")
			.trim()
			.isLength({ min: 5, max: 200 })
			.withMessage("Subject must be between 5 and 200 characters"),
		body("message")
			.trim()
			.isLength({ min: 20, max: 5000 })
			.withMessage("Message must be between 20 and 5000 characters"),
	];

	/**
	 * GET /feedback
	 * Display feedback form
	 */
	static index = (_req: Request, res: Response): void => {
		res.render("feedback/index", {
			title: "Feedback",
			description:
				"Share your feedback, report issues, or request features",
		});
	};

	/**
	 * POST /feedback
	 * Submit feedback and send email to admin
	 */
	static submit = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				res.render("feedback/index", {
					title: "Feedback",
					description:
						"Share your feedback, report issues, or request features",
					errors: errors.array(),
					formData: req.body,
				});
				return;
			}

			const { type, subject, message } = req.body;
			const user = res.locals.user;

			const adminEmail = process.env.ADMIN_EMAIL;

			if (!adminEmail) {
				console.error("ADMIN_EMAIL not configured");
				res.redirect(
					"/feedback?error=" +
						encodeURIComponent(
							"Unable to send feedback. Please try again later.",
						),
				);
				return;
			}

			// Send email to admin
			await emailService.sendFeedbackEmail({
				adminEmail,
				type,
				subject,
				message,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
				},
			});

			res.redirect(
				"/feedback?success=" +
					encodeURIComponent(
						"Thank you for your feedback! We'll review it shortly.",
					),
			);
		} catch (error) {
			next(error);
		}
	};
}
