import prisma from './database';

export interface UnlockedAchievement {
    id: string;
    userAchievementId?: string;
    name: string;
    description: string;
    iconUrl: string | null;
    points: number;
    unlockedAt: Date;
}

export interface AchievementProgress {
    achievement: {
        id: string;
        name: string;
        description: string;
        iconUrl: string | null;
        points: number;
    };
    unlocked: boolean;
    progress: number; // 0-100 percentage
    current: number;
    target: number;
}

/**
 * Service for managing user achievements and auto-awards
 */
export class AchievementService {
    /**
     * Award an achievement to a user (if not already awarded)
     * Returns the achievement if newly awarded, null if already had it
     */
    static async awardAchievement(
        userId: string,
        achievementName: string
    ): Promise<UnlockedAchievement | null> {
        const achievement = await prisma.achievement.findUnique({
            where: { name: achievementName },
        });

        if (!achievement) {
            console.warn(`Achievement not found: ${achievementName}`);
            return null;
        }

        // Check if user already has this achievement
        const existing = await prisma.userAchievement.findUnique({
            where: {
                userId_achievementId: {
                    userId,
                    achievementId: achievement.id,
                },
            },
        });

        if (existing) {
            return null; // Already has it
        }

        // Award the achievement
        const userAchievement = await prisma.userAchievement.create({
            data: {
                userId,
                achievementId: achievement.id,
            },
        });

        console.log(`🏆 Achievement unlocked for user ${userId}: ${achievement.name}`);

        return {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            iconUrl: achievement.iconUrl,
            points: achievement.points,
            unlockedAt: userAchievement.unlockedAt,
        };
    }

    /**
     * Check and award weight-related achievements after logging weight
     */
    static async checkWeightAchievements(userId: string): Promise<UnlockedAchievement[]> {
        const unlocked: UnlockedAchievement[] = [];

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currentWeight: true, goalWeight: true },
        });

        const entries = await prisma.weightEntry.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
        });

        if (entries.length === 0) return unlocked;

        // First Weigh-In
        if (entries.length === 1) {
            const achievement = await this.awardAchievement(userId, 'First Weigh-In');
            if (achievement) unlocked.push(achievement);
        }

        const startWeight = entries[0].weight;
        const currentWeight = user?.currentWeight || entries[entries.length - 1].weight;
        const weightLost = startWeight - currentWeight;

        // Weight loss milestones
        const milestones = [
            { lbs: 5, name: '5 lbs Lost' },
            { lbs: 10, name: '10 lbs Lost' },
            { lbs: 25, name: '25 lbs Lost' },
            { lbs: 50, name: '50 lbs Lost' },
            { lbs: 100, name: '100 lbs Lost' },
        ];

        for (const milestone of milestones) {
            if (weightLost >= milestone.lbs) {
                const achievement = await this.awardAchievement(userId, milestone.name);
                if (achievement) unlocked.push(achievement);
            }
        }

        // Goal Reached
        if (user?.goalWeight && currentWeight <= user.goalWeight) {
            const achievement = await this.awardAchievement(userId, 'Goal Reached');
            if (achievement) unlocked.push(achievement);
        }

        // Perfect Week (lost weight 7 days in a row)
        if (entries.length >= 7) {
            const last7 = entries.slice(-7);
            let perfectWeek = true;
            for (let i = 1; i < last7.length; i++) {
                if (last7[i].weight >= last7[i - 1].weight) {
                    perfectWeek = false;
                    break;
                }
            }
            if (perfectWeek) {
                const achievement = await this.awardAchievement(userId, 'Perfect Week');
                if (achievement) unlocked.push(achievement);
            }
        }

        // Maintenance Master (within 2 lbs of goal for 90 days)
        if (user?.goalWeight && entries.length >= 90) {
            const last90Days = new Date();
            last90Days.setDate(last90Days.getDate() - 90);

            const recent90 = entries.filter(
                (e) => e.recordedAt >= last90Days
            );

            if (recent90.length >= 60) {
                // At least 60 entries in 90 days
                const allNearGoal = recent90.every(
                    (e) => Math.abs(e.weight - user.goalWeight!) <= 2
                );

                if (allNearGoal) {
                    const achievement = await this.awardAchievement(
                        userId,
                        'Maintenance Master'
                    );
                    if (achievement) unlocked.push(achievement);
                }
            }
        }

        // Comeback Kid (logged after 30+ day gap)
        if (entries.length >= 2) {
            const lastEntry = entries[entries.length - 1];
            const previousEntry = entries[entries.length - 2];
            const daysBetween =
                (lastEntry.recordedAt.getTime() - previousEntry.recordedAt.getTime()) /
                (1000 * 60 * 60 * 24);

            if (daysBetween >= 30) {
                const achievement = await this.awardAchievement(userId, 'Comeback Kid');
                if (achievement) unlocked.push(achievement);
            }
        }

        return unlocked;
    }

    /**
     * Check and award consistency streak achievements
     */
    static async checkStreakAchievements(userId: string): Promise<UnlockedAchievement[]> {
        const unlocked: UnlockedAchievement[] = [];

        const entries = await prisma.weightEntry.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
        });

        // Calculate current streak
        let currentStreak = 0;
        let longestStreak = 0;
        const today = new Date();

        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - currentStreak);

            const entryDate = new Date(entry.recordedAt);
            const isSameDay =
                entryDate.toDateString() === expectedDate.toDateString();

            if (isSameDay || currentStreak === 0) {
                currentStreak++;
            } else {
                break;
            }
        }

        // Find longest streak
        let streak = 1;
        for (let i = 1; i < entries.length; i++) {
            const prevDate = new Date(entries[i - 1].recordedAt);
            const currDate = new Date(entries[i].recordedAt);
            const dayDiff = Math.floor(
                (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (dayDiff === 1) {
                streak++;
                longestStreak = Math.max(longestStreak, streak);
            } else {
                streak = 1;
            }
        }

        // Week Warrior (7 day streak)
        if (currentStreak >= 7 || longestStreak >= 7) {
            const achievement = await this.awardAchievement(userId, 'Week Warrior');
            if (achievement) unlocked.push(achievement);
        }

        // 100 Day Streak
        if (currentStreak >= 100 || longestStreak >= 100) {
            const achievement = await this.awardAchievement(userId, '100 Day Streak');
            if (achievement) unlocked.push(achievement);
        }

        // Year of Progress (365 entries)
        if (entries.length >= 365) {
            const achievement = await this.awardAchievement(userId, 'Year of Progress');
            if (achievement) unlocked.push(achievement);
        }

        // Monthly Consistent (4+ weeks with at least 1 entry per week)
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const recentEntries = entries.filter((e) => e.recordedAt >= fourWeeksAgo);

        if (recentEntries.length >= 4) {
            const achievement = await this.awardAchievement(userId, 'Monthly Consistent');
            if (achievement) unlocked.push(achievement);
        }

        return unlocked;
    }

    /**
     * Check and award engagement achievements
     */
    static async checkEngagementAchievements(
        userId: string
    ): Promise<UnlockedAchievement[]> {
        const unlocked: UnlockedAchievement[] = [];

        // Team Player
        const teamCount = await prisma.teamMember.count({ where: { userId } });
        if (teamCount >= 1) {
            const achievement = await this.awardAchievement(userId, 'Team Player');
            if (achievement) unlocked.push(achievement);
        }

        // Social Butterfly
        const postCount = await prisma.post.count({
            where: { authorId: userId, deletedAt: null },
        });
        if (postCount >= 1) {
            const achievement = await this.awardAchievement(userId, 'Social Butterfly');
            if (achievement) unlocked.push(achievement);
        }

        // Challenger
        const challengeCount = await prisma.challengeParticipant.count({
            where: { userId },
        });
        if (challengeCount >= 1) {
            const achievement = await this.awardAchievement(userId, 'Challenger');
            if (achievement) unlocked.push(achievement);
        }

        // Motivator (10 likes received)
        const likesReceived = await prisma.like.count({
            where: {
                post: { authorId: userId },
            },
        });
        if (likesReceived >= 10) {
            const achievement = await this.awardAchievement(userId, 'Motivator');
            if (achievement) unlocked.push(achievement);
        }

        // Popular Post (50 likes on a single post)
        const popularPost = await prisma.post.findFirst({
            where: { authorId: userId },
            include: { _count: { select: { likes: true } } },
            orderBy: { likes: { _count: 'desc' } },
        });
        if (popularPost && popularPost._count.likes >= 50) {
            const achievement = await this.awardAchievement(userId, 'Popular Post');
            if (achievement) unlocked.push(achievement);
        }

        // Helpful (25 comments)
        const commentCount = await prisma.comment.count({
            where: { authorId: userId, deletedAt: null },
        });
        if (commentCount >= 25) {
            const achievement = await this.awardAchievement(userId, 'Helpful');
            if (achievement) unlocked.push(achievement);
        }

        // Progress Photo Pro (10 photos)
        const photoCount = await prisma.progressPhoto.count({
            where: { entry: { userId } },
        });
        if (photoCount >= 10) {
            const achievement = await this.awardAchievement(userId, 'Progress Photo Pro');
            if (achievement) unlocked.push(achievement);
        }

        // Complete Profile
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (
            user &&
            user.displayName &&
            user.bio &&
            user.avatarUrl &&
            user.goalWeight &&
            user.height
        ) {
            const achievement = await this.awardAchievement(userId, 'Complete Profile');
            if (achievement) unlocked.push(achievement);
        }

        return unlocked;
    }

    /**
     * Check and award hidden/secret achievements based on weight entry
     */
    static async checkHiddenAchievements(
        userId: string,
        weight: number,
        recordedAt: Date
    ): Promise<UnlockedAchievement[]> {
        const unlocked: UnlockedAchievement[] = [];
        const hour = recordedAt.getHours();
        const month = recordedAt.getMonth();
        const day = recordedAt.getDate();
        const year = recordedAt.getFullYear();

        // Night Owl - logged between midnight and 4 AM
        if (hour >= 0 && hour < 4) {
            const achievement = await this.awardAchievement(userId, 'Night Owl');
            if (achievement) unlocked.push(achievement);
        }

        // Early Bird - logged between 5 AM and 6 AM
        if (hour >= 5 && hour < 6) {
            const achievement = await this.awardAchievement(userId, 'Early Bird');
            if (achievement) unlocked.push(achievement);
        }

        // New Year Resolution - logged on January 1st
        if (month === 0 && day === 1) {
            const achievement = await this.awardAchievement(userId, 'New Year Resolution');
            if (achievement) unlocked.push(achievement);
        }

        // Holiday Spirit - logged on December 25th
        if (month === 11 && day === 25) {
            const achievement = await this.awardAchievement(userId, 'Holiday Spirit');
            if (achievement) unlocked.push(achievement);
        }

        // Leap of Faith - logged on February 29th
        if (month === 1 && day === 29) {
            const achievement = await this.awardAchievement(userId, 'Leap of Faith');
            if (achievement) unlocked.push(achievement);
        }

        // Precision Master - weight ends in .00
        if (weight % 1 === 0) {
            const achievement = await this.awardAchievement(userId, 'Precision Master');
            if (achievement) unlocked.push(achievement);
        }

        // Milestone Marker - weight is exactly a 10 lb milestone
        if (weight % 10 === 0 && weight >= 100 && weight <= 300) {
            const achievement = await this.awardAchievement(userId, 'Milestone Marker');
            if (achievement) unlocked.push(achievement);
        }

        // Lucky Number - logged 7 times in a single week
        const weekStart = new Date(recordedAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekEntries = await prisma.weightEntry.count({
            where: {
                userId,
                recordedAt: {
                    gte: weekStart,
                    lt: weekEnd,
                },
            },
        });

        if (weekEntries >= 7) {
            const achievement = await this.awardAchievement(userId, 'Lucky Number');
            if (achievement) unlocked.push(achievement);
        }

        // Dedication - logged every day for a full month
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        const daysInMonth = monthEnd.getDate();

        const monthEntries = await prisma.weightEntry.findMany({
            where: {
                userId,
                recordedAt: {
                    gte: monthStart,
                    lte: monthEnd,
                },
            },
            select: { recordedAt: true },
        });

        const uniqueDays = new Set(
            monthEntries.map((e) => e.recordedAt.toDateString())
        );

        if (uniqueDays.size >= daysInMonth) {
            const achievement = await this.awardAchievement(userId, 'Dedication');
            if (achievement) unlocked.push(achievement);
        }

        // Underdog - lost weight after gaining for 3 consecutive days
        const recentEntries = await prisma.weightEntry.findMany({
            where: { userId },
            orderBy: { recordedAt: 'desc' },
            take: 5,
        });

        if (recentEntries.length >= 5) {
            const weights = recentEntries.map((e) => e.weight);
            // Check if: today < yesterday (lost), but yesterday > day before > 2 days ago (3 gains)
            if (
                weights[0] < weights[1] &&
                weights[1] > weights[2] &&
                weights[2] > weights[3] &&
                weights[3] > weights[4]
            ) {
                const achievement = await this.awardAchievement(userId, 'Underdog');
                if (achievement) unlocked.push(achievement);
            }
        }

        return unlocked;
    }

    /**
     * Get all achievements for a user (unlocked + progress on locked)
     */
    static async getUserAchievements(userId: string): Promise<{
        unlocked: UnlockedAchievement[];
        locked: AchievementProgress[];
        totalPoints: number;
        hiddenCount: number;
    }> {
        // Get unlocked achievements
        const unlockedAchievements = await prisma.userAchievement.findMany({
            where: { userId },
            include: { achievement: true },
            orderBy: { unlockedAt: 'desc' },
        });

        const unlocked = unlockedAchievements.map((ua) => ({
            id: ua.achievement.id,
            userAchievementId: ua.id,
            name: ua.achievement.name,
            description: ua.achievement.description,
            iconUrl: ua.achievement.iconUrl,
            points: ua.achievement.points,
            unlockedAt: ua.unlockedAt,
        }));

        const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);

        // Get all visible achievements (exclude hidden ones from locked list)
        const allAchievements = await prisma.achievement.findMany({
            where: { isHidden: false },
        });

        // Calculate progress for locked achievements
        const locked: AchievementProgress[] = [];

        for (const achievement of allAchievements) {
            const isUnlocked = unlocked.some((u) => u.id === achievement.id);
            if (!isUnlocked) {
                const progress = await this.calculateProgress(userId, achievement.name);
                locked.push({
                    achievement: {
                        id: achievement.id,
                        name: achievement.name,
                        description: achievement.description,
                        iconUrl: achievement.iconUrl,
                        points: achievement.points,
                    },
                    unlocked: false,
                    progress: progress.percentage,
                    current: progress.current,
                    target: progress.target,
                });
            }
        }

        // Count hidden achievements for mystery display
        const hiddenCount = await prisma.achievement.count({
            where: { isHidden: true },
        });

        return { unlocked, locked, totalPoints, hiddenCount };
    }

    /**
     * Calculate progress toward a specific achievement
     */
    static async calculateProgress(
        userId: string,
        achievementName: string
    ): Promise<{ current: number; target: number; percentage: number }> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const entries = await prisma.weightEntry.findMany({
            where: { userId },
            orderBy: { recordedAt: 'asc' },
        });

        let current = 0;
        let target = 1;

        switch (achievementName) {
            case 'First Weigh-In':
                current = entries.length > 0 ? 1 : 0;
                target = 1;
                break;

            case '5 lbs Lost':
            case '10 lbs Lost':
            case '25 lbs Lost':
            case '50 lbs Lost':
            case '100 lbs Lost':
                if (entries.length > 0) {
                    const startWeight = entries[0].weight;
                    const currentWeight =
                        user?.currentWeight || entries[entries.length - 1].weight;
                    current = Math.max(0, startWeight - currentWeight);
                }
                target = parseInt(achievementName.split(' ')[0]);
                break;

            case 'Team Player':
                current = await prisma.teamMember.count({ where: { userId } });
                target = 1;
                break;

            case 'Social Butterfly':
                current = await prisma.post.count({
                    where: { authorId: userId, deletedAt: null },
                });
                target = 1;
                break;

            case 'Challenger':
                current = await prisma.challengeParticipant.count({ where: { userId } });
                target = 1;
                break;

            case 'Motivator':
                current = await prisma.like.count({
                    where: { post: { authorId: userId } },
                });
                target = 10;
                break;

            case 'Helpful':
                current = await prisma.comment.count({
                    where: { authorId: userId, deletedAt: null },
                });
                target = 25;
                break;

            case 'Progress Photo Pro':
                current = await prisma.progressPhoto.count({
                    where: { entry: { userId } },
                });
                target = 10;
                break;

            default:
                current = 0;
                target = 1;
        }

        const percentage = Math.min(100, Math.round((current / target) * 100));

        return { current, target, percentage };
    }

    /**
     * Get achievement leaderboard - users ranked by total points
     */
    static async getLeaderboard(limit = 50): Promise<{
        rank: number;
        user: {
            id: string;
            username: string;
            displayName: string | null;
            avatarUrl: string | null;
        };
        totalPoints: number;
        achievementCount: number;
    }[]> {
        // Get all users with their achievements
        const usersWithAchievements = await prisma.user.findMany({
            where: {
                isActive: true,
                deletedAt: null,
                profilePublic: true,
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                achievements: {
                    select: {
                        achievement: {
                            select: {
                                points: true,
                            },
                        },
                    },
                },
            },
        });

        // Calculate total points for each user
        const leaderboard = usersWithAchievements
            .map((user) => {
                const totalPoints = user.achievements.reduce(
                    (sum, ua) => sum + ua.achievement.points,
                    0
                );
                return {
                    user: {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl,
                    },
                    totalPoints,
                    achievementCount: user.achievements.length,
                };
            })
            .filter((entry) => entry.totalPoints > 0)
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, limit)
            .map((entry, index) => ({
                rank: index + 1,
                ...entry,
            }));

        return leaderboard;
    }
}
