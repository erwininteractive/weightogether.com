import { Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest } from "../types/auth";
import { authConfig } from "../config/auth";

export class AuthController {
	/**
	 * Validation rules for registration
	 */
	static registerValidation = [
		body("email")
			.isEmail()
			.withMessage("Valid email is required")
			.normalizeEmail(),
		body("username")
			.isLength({ min: 3, max: 30 })
			.withMessage("Username must be between 3 and 30 characters")
			.matches(/^[a-zA-Z0-9_]+$/)
			.withMessage(
				"Username can only contain letters, numbers, and underscores",
			),
		body("password")
			.isLength({ min: 8 })
			.withMessage("Password must be at least 8 characters")
			.matches(/[A-Z]/)
			.withMessage("Password must contain at least one uppercase letter")
			.matches(/[a-z]/)
			.withMessage("Password must contain at least one lowercase letter")
			.matches(/[0-9]/)
			.withMessage("Password must contain at least one number"),
		body("displayName")
			.optional()
			.isLength({ min: 1, max: 100 })
			.withMessage("Display name must be between 1 and 100 characters"),
		body("dateOfBirth")
			.notEmpty()
			.withMessage("Date of birth is required")
			.isISO8601()
			.withMessage("Date of birth must be a valid date")
			.custom((value) => {
				const birthDate = new Date(value);
				const today = new Date();
				const age = today.getFullYear() - birthDate.getFullYear();
				if (age < 13) {
					throw new Error("You must be at least 13 years old to register");
				}
				if (age > 120) {
					throw new Error("Please enter a valid date of birth");
				}
				return true;
			}),
		body("unitSystem")
			.notEmpty()
			.withMessage("Unit system is required")
			.isIn(["IMPERIAL", "METRIC"])
			.withMessage("Unit system must be IMPERIAL or METRIC"),
		body("height")
			.optional({ checkFalsy: true })
			.isFloat({ min: 1, max: 300 })
			.withMessage("Height must be between 1 and 300"),
		body("currentWeight")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0.1, max: 1000 })
			.withMessage("Current weight must be between 0.1 and 1000"),
		body("goalWeight")
			.optional({ checkFalsy: true })
			.isFloat({ min: 0.1, max: 1000 })
			.withMessage("Goal weight must be between 0.1 and 1000"),
		body("activityLevel")
			.optional({ checkFalsy: true })
			.isIn([
				"SEDENTARY",
				"LIGHTLY_ACTIVE",
				"MODERATELY_ACTIVE",
				"VERY_ACTIVE",
				"EXTREMELY_ACTIVE",
			])
			.withMessage("Invalid activity level"),
	];

	/**
	 * Validation rules for login
	 */
	static loginValidation = [
		body("email")
			.isEmail()
			.withMessage("Valid email is required")
			.normalizeEmail(),
		body("password").notEmpty().withMessage("Password is required"),
	];

	/**
	 * POST /auth/register
	 * Register a new user
	 */
	static async register(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
				return;
			}

			const { email, username, password, displayName } = req.body;

			const user = await AuthService.register({
				email,
				username,
				password,
				displayName,
			});

			res.status(201).json({
				success: true,
				message:
					"Registration successful. Please verify your email before logging in.",
				data: {
					user,
				},
			});
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes("already")) {
					res.status(409).json({
						success: false,
						message: error.message,
					});
					return;
				}
			}
			next(error);
		}
	}

	/**
	 * POST /auth/login
	 * Login and receive tokens
	 */
	static async login(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
				return;
			}

			const { email, password } = req.body;

			const { user, tokens } = await AuthService.login(email, password);

			// Set refresh token as httpOnly cookie
			res.cookie(
				authConfig.cookie.refreshTokenName,
				tokens.refreshToken,
				authConfig.cookie.options,
			);

			res.json({
				success: true,
				message: "Login successful",
				data: {
					user,
					tokens: {
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
					},
				},
			});
		} catch (error) {
			if (error instanceof Error) {
				if (
					error.message.includes("Invalid") ||
					error.message.includes("deactivated")
				) {
					res.status(401).json({
						success: false,
						message: error.message,
					});
					return;
				}
			}
			next(error);
		}
	}

	/**
	 * POST /auth/refresh
	 * Refresh access token using refresh token from cookie
	 */
	static async refresh(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			// Accept refresh token from either body or cookie
			const refreshToken =
				req.body.refreshToken ||
				req.cookies[authConfig.cookie.refreshTokenName];

			if (!refreshToken) {
				res.status(400).json({
					success: false,
					message: "Refresh token required",
				});
				return;
			}

			const tokens = await AuthService.refreshTokens(refreshToken);

			// Set new refresh token as httpOnly cookie
			res.cookie(
				authConfig.cookie.refreshTokenName,
				tokens.refreshToken,
				authConfig.cookie.options,
			);

			res.json({
				success: true,
				message: "Tokens refreshed",
				data: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
				},
			});
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes("token")) {
					// Clear the invalid cookie
					res.clearCookie(authConfig.cookie.refreshTokenName);
					res.status(401).json({
						success: false,
						message: error.message,
					});
					return;
				}
			}
			next(error);
		}
	}

	/**
	 * POST /auth/logout
	 * Logout and revoke refresh token
	 */
	static async logout(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const refreshToken =
				req.cookies[authConfig.cookie.refreshTokenName];

			if (refreshToken) {
				await AuthService.logout(refreshToken);
			}

			// Clear the refresh token cookie
			res.clearCookie(authConfig.cookie.refreshTokenName);

			res.json({
				success: true,
				message: "Logged out successfully",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /auth/logout-all
	 * Logout from all devices
	 */
	static async logoutAll(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.status(401).json({
					success: false,
					message: "Authentication required",
				});
				return;
			}

			await AuthService.logoutAll(userId);

			// Clear the refresh token cookie
			res.clearCookie(authConfig.cookie.refreshTokenName);

			res.json({
				success: true,
				message: "Logged out from all devices",
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /auth/me
	 * Get current authenticated user
	 */
	static async me(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.status(401).json({
					success: false,
					message: "Authentication required",
				});
				return;
			}

			const user = await AuthService.getUserById(userId);

			if (!user) {
				res.status(404).json({
					success: false,
					message: "User not found",
				});
				return;
			}

			res.json({
				success: true,
				data: user,
			});
		} catch (error) {
			next(error);
		}
	}
}
