import { Router } from 'express';
import { AchievementController } from '../controllers/AchievementController';
import { authenticate } from '../middleware/auth';

const router = Router();

// API routes (require API authentication)
router.get('/', authenticate, AchievementController.getAchievements);
router.post('/check', authenticate, AchievementController.checkAchievements);

export default router;
