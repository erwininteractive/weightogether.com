import { Router } from "express";
import { WeightController } from "../controllers/WeightController";
import { webAuthenticate } from "../middleware/webAuth";
import { uploadProgress } from "../middleware/upload";

const router = Router();

// All weight routes require authentication
router.use(webAuthenticate);

// GET /progress - Weight progress page with chart
router.get("/", WeightController.index);

// GET /progress/log - Log new weight form (or edit existing)
router.get("/log", WeightController.logForm);

// POST /progress/log - Submit weight entry
router.post(
	"/log",
	uploadProgress.array("photos", 3),
	WeightController.entryValidation,
	WeightController.logSubmit,
);

// POST /progress/delete/:id - Delete entry
router.post("/delete/:id", WeightController.delete);

// POST /progress/photo/:id - Add photo to existing entry
router.post(
	"/photo/:id",
	uploadProgress.array("photos", 3),
	WeightController.addPhoto,
);

// POST /progress/photo/:photoId/visibility - Update photo visibility
router.post(
	"/photo/:photoId/visibility",
	WeightController.updatePhotoVisibility,
);

// DELETE /progress/photo/:photoId - Delete a photo
router.delete("/photo/:photoId", WeightController.deletePhoto);

export default router;
