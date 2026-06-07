import { Router } from "express";
import { ProfileController } from "../controllers/ProfileController";
import { webAuthenticate } from "../middleware/webAuth";
import { uploadAvatar } from "../middleware/upload";

const router = Router();

// All profile routes require authentication
router.use(webAuthenticate);

// GET /profile/edit - Edit profile page
router.get("/edit", ProfileController.edit);

// POST /profile/edit - Update profile
router.post(
	"/edit",
	uploadAvatar.single("avatar"),
	ProfileController.updateValidation,
	ProfileController.update,
);

export default router;
