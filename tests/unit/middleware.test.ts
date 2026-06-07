import { Request, Response, NextFunction } from "express";
import { loadUser } from "../../src/middleware/loadUser";
import {
	authenticate,
	optionalAuth,
	requireTeamMembership,
	requireOwnership,
} from "../../src/middleware/auth";
import { webAuthenticate } from "../../src/middleware/webAuth";
import { AuthService } from "../../src/services/auth.service";
import {
	resetDatabase,
	createTestUser,
	createAuthenticatedUser,
	createTestTeam,
} from "../helpers";
import { AuthenticatedRequest } from "../../src/types/auth";

// Helper to create mock request/response
function createMockReqRes() {
	const req: Partial<AuthenticatedRequest> = {
		cookies: {},
		headers: {},
		params: {},
	};
	const res: Partial<Response> = {
		locals: {},
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
		redirect: jest.fn().mockReturnThis(),
		cookie: jest.fn().mockReturnThis(),
		clearCookie: jest.fn().mockReturnThis(),
	};
	const next: NextFunction = jest.fn();

	return {
		req: req as AuthenticatedRequest,
		res: res as Response,
		next,
	};
}

describe("Middleware", () => {
	beforeEach(async () => {
		await resetDatabase();
		jest.clearAllMocks();
	});

	describe("loadUser", () => {
		it("should set res.locals.user to null if no accessToken", async () => {
			const { req, res, next } = createMockReqRes();

			await loadUser(req as Request, res, next);

			expect(res.locals.user).toBeNull();
			expect(next).toHaveBeenCalled();
		});

		it("should load user if valid accessToken is present", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const { req, res, next } = createMockReqRes();
			req.cookies.accessToken = tokens.accessToken;

			await loadUser(req as Request, res, next);

			expect(res.locals.user).toBeDefined();
			expect(res.locals.user.id).toBe(user.id);
			expect(res.locals.user.email).toBe(user.email);
			expect(next).toHaveBeenCalled();
		});

		it("should not throw error if accessToken is invalid", async () => {
			const { req, res, next } = createMockReqRes();
			req.cookies.accessToken = "invalid-token";

			await loadUser(req as Request, res, next);

			expect(res.locals.user).toBeNull();
			expect(next).toHaveBeenCalled();
		});

		it("should set user to null if user no longer exists", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			// Delete the user
			await createTestUser(); // Create another user
			const { prisma } = await import("../helpers");
			await prisma.user.delete({ where: { id: user.id } });

			const { req, res, next } = createMockReqRes();
			req.cookies.accessToken = tokens.accessToken;

			await loadUser(req as Request, res, next);

			expect(res.locals.user).toBeNull();
			expect(next).toHaveBeenCalled();
		});
	});

	describe("authenticate (API)", () => {
		it("should authenticate with valid Bearer token", () => {
			const { req, res, next } = createMockReqRes();

			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateAccessToken(payload);
			req.headers.authorization = `Bearer ${token}`;

			authenticate(req, res, next);

			expect(req.user).toBeDefined();
			expect(req.user?.sub).toBe("user-123");
			expect(next).toHaveBeenCalled();
		});

		it("should return 401 if no Authorization header", () => {
			const { req, res, next } = createMockReqRes();

			authenticate(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Access token required",
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should return 401 if Authorization header is malformed", () => {
			const { req, res, next } = createMockReqRes();
			req.headers.authorization = "InvalidFormat token";

			authenticate(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Access token required",
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should return 401 if token is invalid", () => {
			const { req, res, next } = createMockReqRes();
			req.headers.authorization = "Bearer invalid-token";

			authenticate(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Invalid or expired access token",
			});
			expect(next).not.toHaveBeenCalled();
		});
	});

	describe("optionalAuth (API)", () => {
		it("should populate req.user if valid token provided", () => {
			const { req, res, next } = createMockReqRes();

			const payload = {
				sub: "user-123",
				email: "test@example.com",
				username: "testuser",
				teams: [],
			};

			const token = AuthService.generateAccessToken(payload);
			req.headers.authorization = `Bearer ${token}`;

			optionalAuth(req, res, next);

			expect(req.user).toBeDefined();
			expect(req.user?.sub).toBe("user-123");
			expect(next).toHaveBeenCalled();
		});

		it("should not populate req.user if no token provided", () => {
			const { req, res, next } = createMockReqRes();

			optionalAuth(req, res, next);

			expect(req.user).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});

		it("should not populate req.user if invalid token", () => {
			const { req, res, next } = createMockReqRes();
			req.headers.authorization = "Bearer invalid-token";

			optionalAuth(req, res, next);

			expect(req.user).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});
	});

	describe("requireTeamMembership", () => {
		it("should allow access if user is team member", async () => {
			const { user } = await createAuthenticatedUser();
			const team = await createTestTeam(user.id);

			const { req, res, next } = createMockReqRes();
			req.params.teamId = team.id;

			const payload = await AuthService.buildJwtPayload(user.id);
			req.user = payload;

			const middleware = requireTeamMembership("teamId");
			middleware(req, res, next);

			expect(next).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});

		it("should return 401 if user not authenticated", () => {
			const { req, res, next } = createMockReqRes();
			req.params.teamId = "team-123";

			const middleware = requireTeamMembership("teamId");
			middleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Authentication required",
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should return 403 if user not team member", async () => {
			const { user: user1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const team = await createTestTeam(user2.id);

			const { req, res, next } = createMockReqRes();
			req.params.teamId = team.id;

			const payload = await AuthService.buildJwtPayload(user1.id);
			req.user = payload;

			const middleware = requireTeamMembership("teamId");
			middleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "You are not a member of this team",
			});
			expect(next).not.toHaveBeenCalled();
		});
	});

	describe("requireOwnership", () => {
		it("should allow access if user owns resource", async () => {
			const { user } = await createAuthenticatedUser();

			const { req, res, next } = createMockReqRes();
			req.params.userId = user.id;

			const payload = await AuthService.buildJwtPayload(user.id);
			req.user = payload;

			const middleware = requireOwnership("userId");
			middleware(req, res, next);

			expect(next).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});

		it("should return 401 if user not authenticated", () => {
			const { req, res, next } = createMockReqRes();
			req.params.userId = "user-123";

			const middleware = requireOwnership("userId");
			middleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Authentication required",
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should return 403 if user does not own resource", async () => {
			const { user: user1 } = await createAuthenticatedUser({
				email: "user1@example.com",
			});
			const { user: user2 } = await createAuthenticatedUser({
				email: "user2@example.com",
			});

			const { req, res, next } = createMockReqRes();
			req.params.userId = user2.id;

			const payload = await AuthService.buildJwtPayload(user1.id);
			req.user = payload;

			const middleware = requireOwnership("userId");
			middleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "You do not have permission to access this resource",
			});
			expect(next).not.toHaveBeenCalled();
		});
	});

	describe("webAuthenticate", () => {
		it("should authenticate with valid accessToken cookie", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			const { req, res, next } = createMockReqRes();
			req.cookies.accessToken = tokens.accessToken;

			await webAuthenticate(req, res, next);

			expect(req.user).toBeDefined();
			expect(req.user?.sub).toBe(user.id);
			expect(next).toHaveBeenCalled();
		});

		it("should redirect to login if no tokens present", async () => {
			const { req, res, next } = createMockReqRes();

			await webAuthenticate(req, res, next);

			expect(res.redirect).toHaveBeenCalled();
			const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
			expect(redirectUrl).toContain("/login");
			expect(redirectUrl).toContain("error=");
			expect(next).not.toHaveBeenCalled();
		});

		it("should refresh tokens if accessToken expired but refreshToken valid", async () => {
			const { tokens } = await createAuthenticatedUser();

			const { req, res, next } = createMockReqRes();
			// Don't set accessToken (simulating expired)
			req.cookies.refreshToken = tokens.refreshToken;

			await webAuthenticate(req, res, next);

			expect(res.cookie).toHaveBeenCalled();
			expect(req.user).toBeDefined();
			expect(next).toHaveBeenCalled();
		});

		it("should redirect to login if refreshToken invalid", async () => {
			const { req, res, next } = createMockReqRes();
			req.cookies.refreshToken = "invalid-token";

			await webAuthenticate(req, res, next);

			expect(res.clearCookie).toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalled();
			const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0];
			expect(redirectUrl).toContain("/login");
			// URL-encoded message
			expect(redirectUrl).toContain("Session%20expired");
			expect(next).not.toHaveBeenCalled();
		});
	});
});
