import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Public routes
router.post(
	"/register",
	AuthController.registerValidation,
	AuthController.register,
);
router.post("/login", AuthController.loginValidation, AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

// Protected routes
router.post("/logout-all", authenticate, AuthController.logoutAll);
router.get("/me", authenticate, AuthController.me);

export default router;
