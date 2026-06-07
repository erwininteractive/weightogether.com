import { Router } from "express";
import { DonateController } from "../controllers/DonateController";
import { optionalAuth } from "../middleware/auth";

const router = Router();
const donateController = new DonateController();

// Web routes
router.get("/donate", donateController.index);
router.get("/donate/thank-you", donateController.thankYou);

// API routes for PayPal integration
router.post("/api/donate/create-order", optionalAuth, donateController.createOrder);
router.post("/api/donate/capture-order", donateController.captureOrder);
router.post("/api/donate/webhook", donateController.webhook);
router.get("/api/donate/stats", donateController.getStats);

export default router;
