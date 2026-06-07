import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { webAuthenticate } from "../middleware/webAuth";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

// User management
router.get(
	"/admin/users",
	webAuthenticate,
	requireAdmin,
	AdminController.listUsers,
);
router.get(
	"/admin/users/:userId",
	webAuthenticate,
	requireAdmin,
	AdminController.viewUser,
);
router.post(
	"/admin/users/:userId/reset-password",
	webAuthenticate,
	requireAdmin,
	AdminController.resetPasswordValidation,
	AdminController.resetPassword,
);
router.post(
	"/admin/users/:userId/toggle-admin",
	webAuthenticate,
	requireAdmin,
	AdminController.toggleAdmin,
);
router.post(
	"/admin/users/:userId/toggle-active",
	webAuthenticate,
	requireAdmin,
	AdminController.toggleActive,
);
router.post(
	"/admin/users/:userId/resend-verification",
	webAuthenticate,
	requireAdmin,
	AdminController.resendVerification,
);
router.post(
	"/admin/users/:userId/delete",
	webAuthenticate,
	requireAdmin,
	AdminController.deleteUser,
);

export default router;
