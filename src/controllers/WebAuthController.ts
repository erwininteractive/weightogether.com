import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { AuthService } from "../services/auth.service";
import { authConfig } from "../config/auth";
import { getConfiguredProviders } from "../config/passport";

/**
 * Controller for web-based authentication pages (renders HTML)
 */
export class WebAuthController {
	/**
	 * GET /login
	 * Render login page
	 */
	static loginPage(req: Request, res: Response, _next: NextFunction): void {
		// If already logged in, redirect to dashboard
		if (req.cookies[authConfig.cookie.refreshTokenName]) {
			res.redirect("/dashboard");
			return;
		}

		res.render("auth/login", {
			title: "Sign In",
			error: req.query.error || null,
			success: req.query.success || null,
			socialProviders: getConfiguredProviders(),
		});
	}

	/**
	 * POST /login
	 * Handle login form submission
	 */
	static async loginSubmit(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.redirect(
					"/login?error=" + encodeURIComponent(errors.array()[0].msg),
				);
				return;
			}

			const { email, password } = req.body;

			const { tokens, user } = await AuthService.login(email, password);

			// Set refresh token as httpOnly cookie
			res.cookie(
				authConfig.cookie.refreshTokenName,
				tokens.refreshToken,
				authConfig.cookie.options,
			);

			// Set access token in a separate cookie for client-side use (or session)
			res.cookie("accessToken", tokens.accessToken, {
				...authConfig.cookie.options,
				httpOnly: false, // Allow JS access for API calls
				maxAge: 15 * 60 * 1000, // 15 minutes
			});

			// Redirect to dashboard with success message
			res.redirect(
				"/dashboard?success=" +
					encodeURIComponent(
						`Welcome back, ${user.displayName || user.username}!`,
					),
			);
		} catch (error) {
			if (error instanceof Error) {
				res.redirect(
					"/login?error=" + encodeURIComponent(error.message),
				);
				return;
			}
			next(error);
		}
	}

	/**
	 * GET /register
	 * Render registration page
	 */
	static registerPage(
		req: Request,
		res: Response,
		_next: NextFunction,
	): void {
		// If already logged in, redirect to dashboard
		if (req.cookies[authConfig.cookie.refreshTokenName]) {
			res.redirect("/dashboard");
			return;
		}

		res.render("auth/register", {
			title: "Create Account",
			errors: [],
			formData: {},
			socialProviders: getConfiguredProviders(),
		});
	}

	/**
	 * POST /register
	 * Handle registration form submission
	 */
	static async registerSubmit(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.redirect(
					"/register?error=" +
						encodeURIComponent(errors.array()[0].msg),
				);
				return;
			}

			const {
				email,
				username,
				password,
				displayName,
				dateOfBirth,
				unitSystem,
				height,
				currentWeight,
				goalWeight,
				activityLevel,
			} = req.body;

			await AuthService.register({
				email,
				username,
				password,
				displayName,
				dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
				unitSystem,
				height: height ? parseFloat(height) : undefined,
				currentWeight: currentWeight
					? parseFloat(currentWeight)
					: undefined,
				goalWeight: goalWeight ? parseFloat(goalWeight) : undefined,
				activityLevel: activityLevel || undefined,
			});

			// Redirect to login with success message
			res.redirect(
				"/login?success=" +
					encodeURIComponent(
						"Account created successfully! You can now sign in.",
					),
			);
		} catch (error) {
			if (error instanceof Error) {
				res.redirect(
					"/register?error=" + encodeURIComponent(error.message),
				);
				return;
			}
			next(error);
		}
	}

	/**
	 * GET /logout
	 * Handle logout
	 */
	static async logout(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const refreshToken =
				req.cookies[authConfig.cookie.refreshTokenName];

			if (refreshToken) {
				await AuthService.logout(refreshToken);
			}

			// Clear cookies
			res.clearCookie(authConfig.cookie.refreshTokenName);
			res.clearCookie("accessToken");

			// Redirect to landing page
			res.redirect(
				"/?success=" +
					encodeURIComponent(
						"You have been logged out successfully.",
					),
			);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /verify-email
	 * Handle email verification via token
	 */
	static async verifyEmail(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const { token } = req.query;

			if (!token || typeof token !== "string") {
				res.redirect(
					"/login?error=" +
						encodeURIComponent("Invalid verification link"),
				);
				return;
			}

			await AuthService.verifyEmail(token);

			res.redirect(
				"/login?success=" +
					encodeURIComponent(
						"Email verified successfully! You can now sign in.",
					),
			);
		} catch (error) {
			if (error instanceof Error) {
				res.redirect(
					"/login?error=" + encodeURIComponent(error.message),
				);
				return;
			}
			next(error);
		}
	}

	/**
	 * GET /resend-verification
	 * Render resend verification page
	 */
	static resendVerificationPage(
		req: Request,
		res: Response,
		_next: NextFunction,
	): void {
		res.render("auth/resend-verification", {
			title: "Resend Verification Email",
			error: req.query.error || null,
			success: req.query.success || null,
		});
	}

	/**
	 * POST /resend-verification
	 * Handle resend verification email request
	 */
	static async resendVerificationSubmit(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.redirect(
					"/resend-verification?error=" +
						encodeURIComponent(errors.array()[0].msg),
				);
				return;
			}

			const { email } = req.body;

			await AuthService.resendVerificationEmail(email);

			res.redirect(
				"/resend-verification?success=" +
					encodeURIComponent(
						"Verification email sent! Please check your inbox.",
					),
			);
		} catch (error) {
			if (error instanceof Error) {
				res.redirect(
					"/resend-verification?error=" +
						encodeURIComponent(error.message),
				);
				return;
			}
			next(error);
		}
	}
}
