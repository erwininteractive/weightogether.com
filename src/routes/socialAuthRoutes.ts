import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { getConfiguredProviders, SocialAuthResult } from "../config/passport";

const router = Router();

// Cookie options for auth tokens
const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
};

/**
 * Helper to handle OAuth callback and set cookies
 */
function handleOAuthCallback(req: Request, res: Response): void {
	// The user object from passport contains our SocialAuthResult
	const authResult = req.user as unknown as SocialAuthResult;

	if (!authResult || !authResult.tokens) {
		res.redirect("/login?error=auth_failed");
		return;
	}

	// Set auth cookies
	res.cookie("accessToken", authResult.tokens.accessToken, {
		...cookieOptions,
		maxAge: 15 * 60 * 1000, // 15 minutes
	});

	res.cookie("refreshToken", authResult.tokens.refreshToken, {
		...cookieOptions,
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});

	// Redirect based on whether this is a new user
	if (authResult.isNewUser) {
		// New user - redirect to profile setup
		res.redirect("/profile/edit?welcome=true");
	} else {
		// Existing user - redirect to dashboard
		res.redirect("/dashboard");
	}
}

// ============================================
// Google OAuth Routes
// ============================================

router.get(
	"/google",
	(_req: Request, res: Response, next: NextFunction) => {
		const providers = getConfiguredProviders();
		if (!providers.google) {
			res.redirect("/login?error=google_not_configured");
			return;
		}
		next();
	},
	passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
	"/google/callback",
	passport.authenticate("google", {
		failureRedirect: "/login?error=google_auth_failed",
		session: false,
	}),
	handleOAuthCallback,
);

// ============================================
// Facebook OAuth Routes
// ============================================

router.get(
	"/facebook",
	(_req: Request, res: Response, next: NextFunction) => {
		const providers = getConfiguredProviders();
		if (!providers.facebook) {
			res.redirect("/login?error=facebook_not_configured");
			return;
		}
		next();
	},
	passport.authenticate("facebook", { scope: ["email"] }),
);

router.get(
	"/facebook/callback",
	passport.authenticate("facebook", {
		failureRedirect: "/login?error=facebook_auth_failed",
		session: false,
	}),
	handleOAuthCallback,
);

// ============================================
// Twitter/X OAuth Routes
// ============================================

router.get(
	"/twitter",
	(_req: Request, res: Response, next: NextFunction) => {
		const providers = getConfiguredProviders();
		if (!providers.twitter) {
			res.redirect("/login?error=twitter_not_configured");
			return;
		}
		next();
	},
	passport.authenticate("twitter"),
);

router.get(
	"/twitter/callback",
	passport.authenticate("twitter", {
		failureRedirect: "/login?error=twitter_auth_failed",
		session: false,
	}),
	handleOAuthCallback,
);

// ============================================
// API endpoint to check configured providers
// ============================================

router.get("/providers", (_req: Request, res: Response) => {
	res.json(getConfiguredProviders());
});

export default router;
