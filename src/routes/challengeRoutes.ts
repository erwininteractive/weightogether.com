import { Router } from "express";
import { ChallengeController } from "../controllers/ChallengeController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// Team challenges
router.get("/teams/:teamId/challenges", webAuthenticate, ChallengeController.listTeamChallenges);
router.get("/teams/:teamId/challenges/new", webAuthenticate, ChallengeController.createForm);
router.post(
	"/teams/:teamId/challenges",
	webAuthenticate,
	ChallengeController.challengeValidation,
	ChallengeController.create,
);

// Individual challenge operations
router.get("/challenges/:id", webAuthenticate, ChallengeController.show);
router.post("/challenges/:id/join", webAuthenticate, ChallengeController.join);
router.post("/challenges/:id/leave", webAuthenticate, ChallengeController.leave);
router.post("/challenges/:id/update-progress", webAuthenticate, ChallengeController.updateProgress);

export default router;
