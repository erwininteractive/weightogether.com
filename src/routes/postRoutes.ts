import { Router } from "express";
import { PostController } from "../controllers/PostController";
import { CommentController } from "../controllers/CommentController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// Team feed - redirect to team page (feed is now integrated)
router.get("/teams/:teamId/feed", webAuthenticate, (req, res) => {
	res.redirect(`/teams/${req.params.teamId}`);
});

// Create post in team
router.post(
	"/teams/:teamId/posts",
	webAuthenticate,
	PostController.postValidation,
	PostController.create,
);

// View individual post
router.get("/posts/:id", webAuthenticate, PostController.show);

// Update post
router.put("/posts/:id", webAuthenticate, PostController.postValidation, PostController.update);

// Delete post
router.delete("/posts/:id", webAuthenticate, PostController.delete);

// Like/unlike post
router.post("/posts/:id/like", webAuthenticate, PostController.toggleLike);

// Comments on posts
router.post(
	"/posts/:postId/comments",
	webAuthenticate,
	CommentController.commentValidation,
	CommentController.create,
);

// Reply to comment
router.post(
	"/comments/:commentId/replies",
	webAuthenticate,
	CommentController.commentValidation,
	CommentController.createReply,
);

// Update comment
router.put(
	"/comments/:id",
	webAuthenticate,
	CommentController.commentValidation,
	CommentController.update,
);

// Delete comment
router.delete("/comments/:id", webAuthenticate, CommentController.delete);

export default router;
