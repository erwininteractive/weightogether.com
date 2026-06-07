import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { authConfig } from "../config/auth";

/**
 * Middleware to load user information into res.locals if a valid accessToken is present.
 * This does not protect routes; it only makes user info available to all views.
 * If the access token is expired but refresh token is valid, it will load user from refresh token.
 */
export async function loadUser(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	// Make user available in templates by default
	res.locals.user = null;

	try {
		const accessToken = req.cookies.accessToken;

		if (accessToken) {
			try {
				const payload = AuthService.verifyAccessToken(accessToken);
				const user = await AuthService.getUserById(payload.sub);
				if (user) {
					res.locals.user = user;
				}
				next();
				return;
			} catch {
				// Access token expired or invalid, try refresh token below
			}
		}

		// Try to load user from refresh token if access token missing/expired
		// Note: We don't consume/rotate the refresh token here - that happens in webAuthenticate
		// We just verify it and load the user so the nav shows correctly
		const refreshToken = req.cookies[authConfig.cookie.refreshTokenName];

		if (refreshToken) {
			try {
				const payload = AuthService.verifyRefreshToken(refreshToken);
				const user = await AuthService.getUserById(payload.sub);
				if (user) {
					res.locals.user = user;
				}
			} catch {
				// Refresh token invalid/expired, user remains null
			}
		}
	} catch (error) {
		// Should not happen, but good to have a catch-all
		console.error("Unexpected error in loadUser middleware:", error);
	}

	next();
}
