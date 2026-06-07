import { Router } from "express";
import { SettingsController } from "../controllers/SettingsController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

router.get("/settings", webAuthenticate, SettingsController.index);
router.post(
	"/settings/preferences",
	webAuthenticate,
	SettingsController.preferencesValidation,
	SettingsController.updatePreferences,
);
router.post(
	"/settings/password",
	webAuthenticate,
	SettingsController.passwordValidation,
	SettingsController.changePassword,
);
router.post("/settings/delete-account", webAuthenticate, SettingsController.deleteAccount);

export default router;
