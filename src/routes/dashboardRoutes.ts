import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
import { webAuthenticate } from "../middleware/webAuth";

const router = Router();

// All dashboard routes require authentication
router.use(webAuthenticate);

// Dashboard home
router.get("/", DashboardController.index);

export default router;
