import { Router } from "express";
import homeRoutes from "./homeRoutes";
import authRoutes from "./authRoutes";
import webAuthRoutes from "./webAuthRoutes";
import socialAuthRoutes from "./socialAuthRoutes";
import dashboardRoutes from "./dashboardRoutes";
import profileRoutes from "./profileRoutes";
import weightRoutes from "./weightRoutes";
import teamRoutes from "./teamRoutes";
import postRoutes from "./postRoutes";
import challengeRoutes from "./challengeRoutes";
import achievementRoutes from "./achievementRoutes";
import achievementApiRoutes from "./achievementApiRoutes";
import settingsRoutes from "./settingsRoutes";
import adminRoutes from "./adminRoutes";
import donateRoutes from "./donateRoutes";
import newsRoutes from "./newsRoutes";
import toastDemoRoutes from "./toastDemoRoutes";
import messageRoutes from "./messageRoutes";
import feedbackRoutes from "./feedbackRoutes";
import { WeightController } from "../controllers/WeightController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// Mount routes
router.use("/", homeRoutes); // Public pages (home, about, resources, contribute)
router.use("/", webAuthRoutes); // Web auth pages (login, register, logout)
router.use("/auth", socialAuthRoutes); // Social auth (Google, Facebook, Twitter)
router.use("/", donateRoutes); // Donate routes (public + PayPal API)
router.use("/", newsRoutes); // News routes (public)
router.use("/toast-demo", toastDemoRoutes); // Toast demo page
router.use("/api/auth", authRoutes); // API auth endpoints (JSON)
router.use("/achievements/api", achievementApiRoutes); // Achievement API endpoints
router.delete("/photo/:photoId", webAuthenticate, WeightController.deletePhoto); // Delete progress photo
router.use("/dashboard", dashboardRoutes);
router.use("/profile", profileRoutes);
router.use("/progress", weightRoutes);
router.use("/teams", teamRoutes);
router.use("/messages", messageRoutes); // Messaging routes
router.use("/feedback", feedbackRoutes); // Feedback form
router.use("/", postRoutes); // Post and comment routes
router.use("/", challengeRoutes); // Challenge routes
router.use("/achievements", achievementRoutes); // Achievement routes
router.use("/", settingsRoutes); // Settings routes
router.use("/", adminRoutes); // Admin routes

// 404 handler
router.use((_req, res) => {
	res.status(404).render("errors/404", {
		title: "Page Not Found",
		message: "The page you are looking for does not exist.",
		user: res.locals.user,
	});
});

export default router;
