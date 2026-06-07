import { Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest } from "../types/auth";
import { authConfig } from "../config/auth";

/**
 * Controller for dashboard pages
 */
export class DashboardController {
	/**
	 * GET /dashboard
	 * Render main dashboard page
	 */
	static async index(
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		try {
			const userId = req.user?.sub;

			if (!userId) {
				res.redirect(
					"/login?error=" +
						encodeURIComponent("Please sign in to continue."),
				);
				return;
			}

			const user = await AuthService.getUserById(userId);

			if (!user) {
				// Clear invalid session
				res.clearCookie(authConfig.cookie.refreshTokenName);
				res.clearCookie("accessToken");
				res.redirect(
					"/login?error=" +
						encodeURIComponent(
							"Session expired. Please sign in again.",
						),
				);
				return;
			}

			res.render("dashboard/index", {
				title: "Dashboard",
				user,
			});
		} catch (error) {
			next(error);
		}
	}
}
