import { Router } from 'express';
import { AchievementController } from '../controllers/AchievementController';
import { webAuthenticate } from '../middleware/webAuth';

const router = Router();

// Public routes (user loaded via global middleware)
router.get('/leaderboard', AchievementController.showLeaderboard);
router.get('/share/:achievementId/:odataId', AchievementController.shareAchievement);

// Web routes (require web authentication)
router.get('/', webAuthenticate, AchievementController.index);
router.get(
    '/user/:userId',
    webAuthenticate,
    AchievementController.userAchievements
);

export default router;
