import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import '../src/config/env';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Default achievements to seed
 */
const achievements = [
    // Weight Loss Milestones
    {
        name: 'First Weigh-In',
        description: 'Logged your first weight entry',
        iconUrl: '⚖️',
        points: 10,
    },
    {
        name: '5 lbs Lost',
        description: 'Lost 5 pounds from your starting weight',
        iconUrl: '🎯',
        points: 50,
    },
    {
        name: '10 lbs Lost',
        description: 'Lost 10 pounds from your starting weight',
        iconUrl: '🏆',
        points: 100,
    },
    {
        name: '25 lbs Lost',
        description: 'Lost 25 pounds from your starting weight',
        iconUrl: '⭐',
        points: 250,
    },
    {
        name: '50 lbs Lost',
        description: 'Lost 50 pounds from your starting weight',
        iconUrl: '🌟',
        points: 500,
    },
    {
        name: '100 lbs Lost',
        description: 'Lost 100 pounds from your starting weight',
        iconUrl: '💎',
        points: 1000,
    },
    {
        name: 'Goal Reached',
        description: 'Reached your goal weight',
        iconUrl: '🎉',
        points: 500,
    },

    // Consistency Streaks
    {
        name: 'Week Warrior',
        description: 'Logged weight 7 days in a row',
        iconUrl: '🔥',
        points: 100,
    },
    {
        name: 'Monthly Consistent',
        description: 'Logged weight at least once per week for 4 weeks',
        iconUrl: '📅',
        points: 200,
    },
    {
        name: '100 Day Streak',
        description: 'Logged weight 100 days in a row',
        iconUrl: '💯',
        points: 500,
    },
    {
        name: 'Year of Progress',
        description: 'Logged weight for 365 days',
        iconUrl: '🗓️',
        points: 1000,
    },

    // Engagement
    {
        name: 'Team Player',
        description: 'Joined your first team',
        iconUrl: '👥',
        points: 50,
    },
    {
        name: 'Social Butterfly',
        description: 'Created your first post',
        iconUrl: '🦋',
        points: 25,
    },
    {
        name: 'Challenger',
        description: 'Joined your first challenge',
        iconUrl: '🏅',
        points: 50,
    },
    {
        name: 'Motivator',
        description: 'Received 10 likes on your posts',
        iconUrl: '❤️',
        points: 100,
    },
    {
        name: 'Helpful',
        description: 'Made 25 comments to support others',
        iconUrl: '💬',
        points: 150,
    },
    {
        name: 'Popular Post',
        description: 'Had a post receive 50 likes',
        iconUrl: '🔥',
        points: 200,
    },

    // Body Composition
    {
        name: 'Body Fat Champion',
        description: 'Reduced body fat percentage by 5%',
        iconUrl: '💪',
        points: 300,
    },
    {
        name: 'Muscle Builder',
        description: 'Increased muscle mass by 10 lbs',
        iconUrl: '🏋️',
        points: 300,
    },
    {
        name: 'Hydration Hero',
        description: 'Maintained 60%+ water percentage for 30 days',
        iconUrl: '💧',
        points: 200,
    },

    // Special Achievements
    {
        name: 'Early Adopter',
        description: 'One of the first 100 users',
        iconUrl: '🚀',
        points: 500,
    },
    {
        name: 'Supporter',
        description: 'Made a donation to support the platform',
        iconUrl: '💝',
        points: 250,
    },
    {
        name: 'Monthly Supporter',
        description: 'Active monthly donation subscription',
        iconUrl: '🌈',
        points: 500,
    },
    {
        name: 'Progress Photo Pro',
        description: 'Uploaded 10 progress photos',
        iconUrl: '📸',
        points: 100,
    },
    {
        name: 'Complete Profile',
        description: 'Filled out all profile information',
        iconUrl: '✅',
        points: 50,
    },
    {
        name: 'Challenge Champion',
        description: 'Won your first challenge',
        iconUrl: '🥇',
        points: 300,
    },
    {
        name: 'Comeback Kid',
        description: 'Logged weight after 30+ day gap',
        iconUrl: '🔄',
        points: 100,
    },
    {
        name: 'Perfect Week',
        description: 'Lost weight 7 days in a row',
        iconUrl: '📉',
        points: 200,
    },
    {
        name: 'Maintenance Master',
        description: 'Maintained goal weight for 90 days',
        iconUrl: '🎯',
        points: 400,
    },

    // Hidden/Secret Achievements
    {
        name: 'Night Owl',
        description: 'Logged weight between midnight and 4 AM',
        iconUrl: '🦉',
        points: 50,
        isHidden: true,
    },
    {
        name: 'Early Bird',
        description: 'Logged weight between 5 AM and 6 AM',
        iconUrl: '🐦',
        points: 50,
        isHidden: true,
    },
    {
        name: 'New Year Resolution',
        description: 'Logged weight on January 1st',
        iconUrl: '🎆',
        points: 100,
        isHidden: true,
    },
    {
        name: 'Holiday Spirit',
        description: 'Logged weight on December 25th',
        iconUrl: '🎄',
        points: 100,
        isHidden: true,
    },
    {
        name: 'Leap of Faith',
        description: 'Logged weight on February 29th',
        iconUrl: '🐸',
        points: 200,
        isHidden: true,
    },
    {
        name: 'Precision Master',
        description: 'Logged a weight that ends in .00',
        iconUrl: '🎯',
        points: 25,
        isHidden: true,
    },
    {
        name: 'Lucky Number',
        description: 'Logged weight 7 times in a single week',
        iconUrl: '🍀',
        points: 75,
        isHidden: true,
    },
    {
        name: 'Dedication',
        description: 'Logged weight every day for a full month',
        iconUrl: '📆',
        points: 300,
        isHidden: true,
    },
    {
        name: 'Milestone Marker',
        description: 'Reached exactly a 10 lb milestone (180, 170, 160, etc.)',
        iconUrl: '🏁',
        points: 50,
        isHidden: true,
    },
    {
        name: 'Underdog',
        description: 'Lost weight after gaining for 3 consecutive days',
        iconUrl: '🐕',
        points: 75,
        isHidden: true,
    },
];

async function seedAchievements() {
    console.log('🏆 Seeding achievements...');

    let created = 0;
    let skipped = 0;

    for (const achievement of achievements) {
        const existing = await prisma.achievement.findUnique({
            where: { name: achievement.name },
        });

        if (existing) {
            console.log(`⏭️  Skipped: ${achievement.name} (already exists)`);
            skipped++;
        } else {
            await prisma.achievement.create({
                data: achievement,
            });
            console.log(`✅ Created: ${achievement.name}`);
            created++;
        }
    }

    console.log(`\n✨ Done! Created ${created} achievements, skipped ${skipped}`);
}

async function main() {
    try {
        await seedAchievements();
    } catch (error) {
        console.error('Error seeding achievements:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();
