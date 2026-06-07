import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/auth";
import prisma from "../services/database";

/**
 * Check if the request expects a JSON response (AJAX/fetch request)
 */
function expectsJson(req: AuthenticatedRequest): boolean {
	const accept = req.headers.accept || "";
	return (
		req.xhr ||
		accept.includes("application/json") ||
		req.headers["x-requested-with"] === "XMLHttpRequest"
	);
}

/**
 * Middleware to check if the authenticated user is an admin
 * Must be used after webAuthenticate or authenticate middleware
 */
export async function requireAdmin(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> {
	try {
		if (!req.user) {
			if (expectsJson(req)) {
				res.status(401).json({
					success: false,
					message: "Please log in to access this page",
				});
			} else {
				res.status(401).render("errors/401", {
					title: "Unauthorized",
					message: "Please log in to access this page",
				});
			}
			return;
		}

		// Check if user is admin
		const user = await prisma.user.findUnique({
			where: { id: req.user.sub },
			select: { isAdmin: true },
		});

		if (!user || !user.isAdmin) {
			if (expectsJson(req)) {
				res.status(403).json({
					success: false,
					message: "You must be an administrator to access this page",
				});
			} else {
				res.status(403).render("errors/403", {
					title: "Access Denied",
					message: "You must be an administrator to access this page",
				});
			}
			return;
		}

		next();
	} catch (error) {
		next(error);
	}
}
