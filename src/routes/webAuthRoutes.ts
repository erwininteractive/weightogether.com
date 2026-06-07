import { Router } from "express";
import { body } from "express-validator";
import { WebAuthController } from "../controllers/WebAuthController";
import { AuthController } from "../controllers/AuthController";

const router = Router();

// Login
router.get("/login", WebAuthController.loginPage);
router.post(
	"/login",
	AuthController.loginValidation,
	WebAuthController.loginSubmit,
);

// Register
router.get("/register", WebAuthController.registerPage);
router.post(
	"/register",
	AuthController.registerValidation,
	WebAuthController.registerSubmit,
);

// Email Verification
router.get("/verify-email", WebAuthController.verifyEmail);
router.get("/resend-verification", WebAuthController.resendVerificationPage);
router.post(
	"/resend-verification",
	[body("email").isEmail().withMessage("Please provide a valid email")],
	WebAuthController.resendVerificationSubmit,
);

// Logout
router.get("/logout", WebAuthController.logout);

export default router;
