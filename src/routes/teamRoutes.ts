import { Router } from "express";
import { TeamController } from "../controllers/TeamController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// All team routes require authentication
router.use(webAuthenticate);

// GET /teams - List user's teams and discover public teams
router.get("/", TeamController.index);

// GET /teams/create - Create team form
router.get("/create", TeamController.createForm);

// POST /teams/create - Submit new team
router.post("/create", TeamController.teamValidation, TeamController.create);

// GET /teams/join/:code - Join via invite code page
router.get("/join/:code", TeamController.joinViaCode);

// POST /teams/join/:code - Confirm join via invite code
router.post("/join/:code", TeamController.confirmJoinViaCode);

// GET /teams/:id - Team detail page
router.get("/:id", TeamController.show);

// GET /teams/:id/edit - Edit team form
router.get("/:id/edit", TeamController.editForm);

// POST /teams/:id/edit - Submit team edit
router.post("/:id/edit", TeamController.teamValidation, TeamController.update);

// POST /teams/:id/join - Join a public team
router.post("/:id/join", TeamController.join);

// POST /teams/:id/leave - Leave team
router.post("/:id/leave", TeamController.leave);

// POST /teams/:id/delete - Delete team (owner only)
router.post("/:id/delete", TeamController.delete);

// POST /teams/:id/regenerate-invite - Regenerate invite code (JSON response)
router.post("/:id/regenerate-invite", TeamController.regenerateInvite);

// POST /teams/:id/members/:memberId/role - Update member role (JSON response)
router.post("/:id/members/:memberId/role", TeamController.updateMemberRole);

// POST /teams/:id/members/:memberId/remove - Remove member
router.post("/:id/members/:memberId/remove", TeamController.removeMember);

export default router;
