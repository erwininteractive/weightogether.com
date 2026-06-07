import { Response, NextFunction } from "express";
import { requireAdmin } from "../../src/middleware/adminAuth";
import { AuthenticatedRequest } from "../../src/types/auth";
import { resetDatabase, createAuthenticatedUser } from "../helpers";
import { AuthService } from "../../src/services/auth.service";

// Helper to create mock request/response
function createMockReqRes(
	overrides: {
		user?: AuthenticatedRequest["user"];
		headers?: Record<string, string>;
		xhr?: boolean;
	} = {},
) {
	const req = {
		user: overrides.user,
		headers: overrides.headers || {},
		xhr: overrides.xhr || false,
	} as AuthenticatedRequest;
	const res: Partial<Response> = {
		locals: {},
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
		render: jest.fn().mockReturnThis(),
	};
	const next: NextFunction = jest.fn();

	return {
		req,
		res: res as Response,
		next,
	};
}

describe("Admin Auth Middleware", () => {
	beforeEach(async () => {
		await resetDatabase();
		jest.clearAllMocks();
	});

	describe("requireAdmin", () => {
		describe("Unauthenticated requests", () => {
			it("should return 401 JSON for unauthenticated API request", async () => {
				const { req, res, next } = createMockReqRes({
					headers: { accept: "application/json" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalledWith({
					success: false,
					message: "Please log in to access this page",
				});
				expect(next).not.toHaveBeenCalled();
			});

			it("should render 401 page for unauthenticated web request", async () => {
				const { req, res, next } = createMockReqRes({
					headers: { accept: "text/html" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.render).toHaveBeenCalledWith("errors/401", {
					title: "Unauthorized",
					message: "Please log in to access this page",
				});
				expect(next).not.toHaveBeenCalled();
			});

			it("should detect XHR requests as JSON", async () => {
				const { req, res, next } = createMockReqRes({
					xhr: true,
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalled();
				expect(res.render).not.toHaveBeenCalled();
			});

			it("should detect X-Requested-With header as JSON", async () => {
				const { req, res, next } = createMockReqRes({
					headers: { "x-requested-with": "XMLHttpRequest" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalled();
			});
		});

		describe("Non-admin users", () => {
			it("should return 403 JSON for non-admin API request", async () => {
				const { user } = await createAuthenticatedUser({
					isAdmin: false,
				});
				const payload = await AuthService.buildJwtPayload(user.id);

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "application/json" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(403);
				expect(res.json).toHaveBeenCalledWith({
					success: false,
					message: "You must be an administrator to access this page",
				});
				expect(next).not.toHaveBeenCalled();
			});

			it("should render 403 page for non-admin web request", async () => {
				const { user } = await createAuthenticatedUser({
					isAdmin: false,
				});
				const payload = await AuthService.buildJwtPayload(user.id);

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "text/html" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(403);
				expect(res.render).toHaveBeenCalledWith("errors/403", {
					title: "Access Denied",
					message: "You must be an administrator to access this page",
				});
				expect(next).not.toHaveBeenCalled();
			});
		});

		describe("Admin users", () => {
			it("should call next() for admin users", async () => {
				const { user } = await createAuthenticatedUser({
					isAdmin: true,
				});
				const payload = await AuthService.buildJwtPayload(user.id);

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "application/json" },
				});

				await requireAdmin(req, res, next);

				expect(next).toHaveBeenCalled();
				expect(res.status).not.toHaveBeenCalled();
				expect(res.json).not.toHaveBeenCalled();
				expect(res.render).not.toHaveBeenCalled();
			});

			it("should work for admin web requests too", async () => {
				const { user } = await createAuthenticatedUser({
					isAdmin: true,
				});
				const payload = await AuthService.buildJwtPayload(user.id);

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "text/html" },
				});

				await requireAdmin(req, res, next);

				expect(next).toHaveBeenCalled();
				expect(res.status).not.toHaveBeenCalled();
			});
		});

		describe("Edge cases", () => {
			it("should handle user not found in database", async () => {
				// Create a valid JWT payload for a non-existent user
				const fakePayload = {
					sub: "00000000-0000-0000-0000-000000000000",
					email: "fake@example.com",
					username: "fakeuser",
					teams: [],
				};

				const { req, res, next } = createMockReqRes({
					user: fakePayload,
					headers: { accept: "application/json" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(403);
				expect(res.json).toHaveBeenCalledWith({
					success: false,
					message: "You must be an administrator to access this page",
				});
				expect(next).not.toHaveBeenCalled();
			});

			it("should handle user with isAdmin: false explicitly", async () => {
				const { user } = await createAuthenticatedUser();

				// Explicitly set isAdmin to false (it's already false by default)
				const { prisma } = await import("../helpers");
				await prisma.user.update({
					where: { id: user.id },
					data: { isAdmin: false },
				});

				const payload = await AuthService.buildJwtPayload(user.id);

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "application/json" },
				});

				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(403);
				expect(next).not.toHaveBeenCalled();
			});

			it("should properly check admin status from database (not JWT)", async () => {
				// Create a user who was admin, but had admin revoked
				const { user } = await createAuthenticatedUser({
					isAdmin: true, // Created as admin
				});

				// Build JWT while user is admin
				const payload = await AuthService.buildJwtPayload(user.id);

				// Revoke admin status in database
				const { prisma } = await import("../helpers");
				await prisma.user.update({
					where: { id: user.id },
					data: { isAdmin: false },
				});

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "application/json" },
				});

				// Middleware should check database, not just JWT
				await requireAdmin(req, res, next);

				expect(res.status).toHaveBeenCalledWith(403);
				expect(next).not.toHaveBeenCalled();
			});

			it("should grant access to user who became admin after JWT was issued", async () => {
				const { user } = await createAuthenticatedUser({
					isAdmin: false, // Created as non-admin
				});

				// Build JWT while user is not admin
				const payload = await AuthService.buildJwtPayload(user.id);

				// Grant admin status in database
				const { prisma } = await import("../helpers");
				await prisma.user.update({
					where: { id: user.id },
					data: { isAdmin: true },
				});

				const { req, res, next } = createMockReqRes({
					user: payload,
					headers: { accept: "application/json" },
				});

				// Middleware should check database and grant access
				await requireAdmin(req, res, next);

				expect(next).toHaveBeenCalled();
				expect(res.status).not.toHaveBeenCalled();
			});
		});
	});
});
