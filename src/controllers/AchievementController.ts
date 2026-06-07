import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { AchievementService } from '../services/achievement.service';
import prisma from '../services/database';

/**
 * Controller for user achievements
 */
export class AchievementController {
    /**
     * GET /achievements
     * Display user's achievements page
     */
    static async index(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.sub;

            if (!userId) {
                res.redirect('/login');
                return;
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                res.redirect('/login');
                return;
            }

            // Get user's achievements
            const { unlocked, locked, totalPoints, hiddenCount } =
                await AchievementService.getUserAchievements(userId);

            // Sort locked by progress (highest first)
            locked.sort((a, b) => b.progress - a.progress);

            res.render('achievements/index', {
                title: 'My Achievements',
                user,
                unlocked,
                locked,
                totalPoints,
                unlockedCount: unlocked.length,
                totalCount: unlocked.length + locked.length + hiddenCount,
                hiddenCount,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/achievements
     * Get user's achievements (API endpoint)
     */
    static async getAchievements(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.sub;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const achievements = await AchievementService.getUserAchievements(
                userId
            );

            res.json({
                success: true,
                data: achievements,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /profile/:userId/achievements
     * View another user's unlocked achievements
     */
    static async userAchievements(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { userId } = req.params;
            const currentUserId = req.user?.sub;

            const user = await prisma.user.findUnique({
                where: { id: userId, deletedAt: null },
            });

            if (!user) {
                res.status(404).render('errors/404', {
                    title: 'User Not Found',
                    message: 'This user does not exist.',
                });
                return;
            }

            // Only show if profile is public or it's the current user
            if (!user.profilePublic && userId !== currentUserId) {
                res.status(403).render('errors/403', {
                    title: 'Private Profile',
                    message: 'This user\'s profile is private.',
                });
                return;
            }

            const { unlocked, totalPoints } =
                await AchievementService.getUserAchievements(userId);

            res.render('achievements/user', {
                title: `${user.displayName || user.username}'s Achievements`,
                user: currentUserId
                    ? await prisma.user.findUnique({ where: { id: currentUserId } })
                    : null,
                profileUser: user,
                unlocked,
                totalPoints,
                unlockedCount: unlocked.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/achievements/check
     * Manually trigger achievement check (for testing)
     */
    static async checkAchievements(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.sub;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const unlocked = [];

            // Check all types
            const weightAchievements =
                await AchievementService.checkWeightAchievements(userId);
            unlocked.push(...weightAchievements);

            const streakAchievements =
                await AchievementService.checkStreakAchievements(userId);
            unlocked.push(...streakAchievements);

            const engagementAchievements =
                await AchievementService.checkEngagementAchievements(userId);
            unlocked.push(...engagementAchievements);

            res.json({
                success: true,
                message: `Checked achievements. Unlocked ${unlocked.length} new achievements.`,
                unlocked,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /achievements/leaderboard
     * Show achievement points leaderboard
     */
    static async showLeaderboard(
        _req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            // Use res.locals.user for public routes (set by loadUser middleware)
            const user = res.locals.user;
            const leaderboard = await AchievementService.getLeaderboard(50);

            // Find current user's rank if logged in
            let userRank = null;
            if (user) {
                const userId = user.id;
                const userEntry = leaderboard.find((entry) => entry.user.id === userId);
                if (userEntry) {
                    userRank = userEntry.rank;
                } else {
                    // User not in top 50, calculate their points
                    const { totalPoints } = await AchievementService.getUserAchievements(userId);
                    if (totalPoints > 0) {
                        // Count how many users have more points
                        const usersAbove = leaderboard.filter((e) => e.totalPoints > totalPoints).length;
                        userRank = usersAbove + 1;
                    }
                }
            }

            res.render('achievements/leaderboard', {
                title: 'Achievement Leaderboard',
                user,
                leaderboard,
                userRank,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /achievements/share/:achievementId/:odataId
     * Public page for sharing a specific achievement
     */
    static async shareAchievement(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { achievementId, odataId } = req.params;
            // Use res.locals.user for public routes (set by loadUser middleware)
            const currentUser = res.locals.user;

            // Find the user achievement
            const userAchievement = await prisma.userAchievement.findFirst({
                where: {
                    id: odataId,
                    achievementId,
                },
                include: {
                    achievement: true,
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            profilePublic: true,
                        },
                    },
                },
            });

            if (!userAchievement) {
                res.status(404).render('errors/404', {
                    title: 'Achievement Not Found',
                    user: currentUser,
                    message: 'This achievement could not be found.',
                });
                return;
            }

            // Check if user's profile is public
            if (!userAchievement.user.profilePublic) {
                res.status(403).render('errors/403', {
                    title: 'Private Profile',
                    user: currentUser,
                    message: 'This user has a private profile.',
                });
                return;
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const shareUrl = `${baseUrl}/achievements/share/${achievementId}/${odataId}`;

            res.render('achievements/share', {
                title: `${userAchievement.user.displayName || userAchievement.user.username} earned ${userAchievement.achievement.name}`,
                user: currentUser,
                achievement: userAchievement.achievement,
                achievementUser: userAchievement.user,
                unlockedAt: userAchievement.unlockedAt,
                shareUrl,
                ogImage: `${baseUrl}/og/achievement/${achievementId}`,
            });
        } catch (error) {
            next(error);
        }
    }
}
