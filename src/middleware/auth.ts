import { Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest, JwtPayload } from "../types/auth";

/**
 * Middleware to authenticate requests using JWT access token
 */
export const authenticate = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): void => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			res.status(401).json({
				success: false,
				message: "Access token required",
			});
			return;
		}

		const token = authHeader.split(" ")[1];

		try {
			const payload = AuthService.verifyAccessToken(token);
			req.user = payload;
			next();
		} catch {
			res.status(401).json({
				success: false,
				message: "Invalid or expired access token",
			});
			return;
		}
	} catch (error) {
		next(error);
	}
};

/**
 * Optional authentication - populates req.user if token is valid, but doesn't require it
 */
export const optionalAuth = (
	req: AuthenticatedRequest,
	_res: Response,
	next: NextFunction,
): void => {
	try {
		const authHeader = req.headers.authorization;

		if (authHeader && authHeader.startsWith("Bearer ")) {
			const token = authHeader.split(" ")[1];
			try {
				const payload = AuthService.verifyAccessToken(token);
				req.user = payload;
			} catch {
				// Token invalid, but that's okay for optional auth
			}
		}

		next();
	} catch (error) {
		next(error);
	}
};

/**
 * Middleware to check if user is a member of a specific team
 */
export const requireTeamMembership = (teamIdParam: string = "teamId") => {
	return (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): void => {
		const teamId = req.params[teamIdParam];
		const user = req.user as JwtPayload;

		if (!user) {
			res.status(401).json({
				success: false,
				message: "Authentication required",
			});
			return;
		}

		if (!user.teams.includes(teamId)) {
			res.status(403).json({
				success: false,
				message: "You are not a member of this team",
			});
			return;
		}

		next();
	};
};

/**
 * Middleware to check if user owns the resource (by userId param)
 */
export const requireOwnership = (userIdParam: string = "userId") => {
	return (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	): void => {
		const resourceUserId = req.params[userIdParam];
		const user = req.user as JwtPayload;

		if (!user) {
			res.status(401).json({
				success: false,
				message: "Authentication required",
			});
			return;
		}

		if (user.sub !== resourceUserId) {
			res.status(403).json({
				success: false,
				message: "You do not have permission to access this resource",
			});
			return;
		}

		next();
	};
};
