import request from "supertest";
import app from "../../src/server";
import { prisma, resetDatabase, createAuthenticatedUser } from "../helpers";

describe("Dashboard Routes", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	describe("GET /dashboard", () => {
		it("should render dashboard for authenticated user", async () => {
			const { tokens } = await createAuthenticatedUser({
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.get("/dashboard")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(200);

			expect(response.text).toContain("Dashboard");
		});

		it("should redirect to login if not authenticated", async () => {
			const response = await request(app).get("/dashboard").expect(302);

			expect(response.headers.location).toContain("/login");
			expect(response.headers.location).toContain("error=");
		});

		it("should redirect to login if user no longer exists", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			// Delete the user
			await prisma.user.delete({ where: { id: user.id } });

			const response = await request(app)
				.get("/dashboard")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers.location).toContain("/login");
			// URL-encoded message
			expect(response.headers.location).toContain("Session%20expired");
		});

		it("should clear cookies on invalid session", async () => {
			const { user, tokens } = await createAuthenticatedUser();

			// Delete the user
			await prisma.user.delete({ where: { id: user.id } });

			const response = await request(app)
				.get("/dashboard")
				.set("Cookie", [`refreshToken=${tokens.refreshToken}`])
				.expect(302);

			expect(response.headers["set-cookie"]).toBeDefined();
			// Check if cookies are being cleared (either Max-Age=0 or Expires in past)
			const setCookieHeaders = response.headers["set-cookie"];
			const cookiesArray = Array.isArray(setCookieHeaders)
				? setCookieHeaders
				: [setCookieHeaders];
			const cookiesCleared = cookiesArray.some(
				(cookie: string) =>
					cookie.includes("refreshToken=") &&
					(cookie.includes("Max-Age=0") ||
						cookie.includes("Expires=Thu, 01 Jan 1970")),
			);
			expect(cookiesCleared).toBe(true);
		});
	});
});
