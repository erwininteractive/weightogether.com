import { Router } from "express";
import { NewsController } from "../controllers/NewsController";

const router = Router();
const newsController = new NewsController();

router.get("/news", newsController.index);

export default router;
