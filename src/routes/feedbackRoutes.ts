import { Router } from "express";
import { FeedbackController } from "../controllers/FeedbackController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// All feedback routes require authentication
router.get("/", webAuthenticate, FeedbackController.index);
router.post(
	"/",
	webAuthenticate,
	FeedbackController.submitValidation,
	FeedbackController.submit,
);

export default router;
