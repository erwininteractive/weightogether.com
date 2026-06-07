import { Router } from "express";
import { MessageController } from "../controllers/MessageController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// All message routes require authentication
router.use(webAuthenticate);

// Web routes
router.get("/", MessageController.listTeamFeeds);

// Post read tracking
router.post(
	"/posts/:postId/read",
	MessageController.markPostReadValidation,
	MessageController.markPostAsRead,
);

// Team chat endpoints
router.get("/team/:teamId", MessageController.getTeamConversation);
router.post(
	"/team/:teamId",
	MessageController.teamMessageValidation,
	MessageController.sendTeamMessage,
);
router.post("/team/:teamId/read", MessageController.markTeamAsRead);

// Conversation routes with :conversationId parameter
router.get("/:conversationId", MessageController.showConversation);
router.post(
	"/:conversationId",
	MessageController.sendMessageValidation,
	MessageController.sendMessage,
);
router.post("/:conversationId/read", MessageController.markAsRead);

// Message edit/delete (API-style for AJAX)
router.put(
	"/:conversationId/:messageId",
	MessageController.editMessageValidation,
	MessageController.editMessage,
);
router.delete(
	"/:conversationId/:messageId",
	MessageController.messageActionValidation,
	MessageController.deleteMessage,
);

export default router;
