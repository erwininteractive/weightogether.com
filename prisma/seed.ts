import "../src/config/env";

import {
	PrismaClient,
	UnitSystem,
	Gender,
	ActivityLevel,
	TeamRole,
	PostType,
	PostVisibility,
	EntryVisibility,
	ChallengeType,
	ChallengeStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Default password for all seed users
const DEFAULT_PASSWORD = "Password123";

async function main() {
	console.log("Seeding database...");

	// Hash the default password
	const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
	console.log(`Using default password: ${DEFAULT_PASSWORD}`);

	// Clean existing data (preserve admin users)
	const adminUserIds = (
		await prisma.user.findMany({
			where: { isAdmin: true },
			select: { id: true },
		})
	).map((u) => u.id);

	await prisma.userAchievement.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.achievement.deleteMany();
	await prisma.challengeParticipant.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.challenge.deleteMany();
	await prisma.message.deleteMany();
	await prisma.conversationParticipant.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.conversation.deleteMany();
	await prisma.like.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.comment.deleteMany({
		where: { authorId: { notIn: adminUserIds } },
	});
	await prisma.post.deleteMany({
		where: { authorId: { notIn: adminUserIds } },
	});
	await prisma.teamMember.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.team.deleteMany({
		where: { ownerId: { notIn: adminUserIds } },
	});
	await prisma.progressPhoto.deleteMany();
	await prisma.weightEntry.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.refreshToken.deleteMany({
		where: { userId: { notIn: adminUserIds } },
	});
	await prisma.user.deleteMany({
		where: { isAdmin: false },
	});

	if (adminUserIds.length > 0) {
		console.log(`Preserved ${adminUserIds.length} admin user(s)`);
	}

	// Create Users
	const user1 = await prisma.user.create({
		data: {
			email: "john@example.com",
			username: "johndoe",
			passwordHash,
			displayName: "John Doe",
			bio: "Fitness enthusiast on a weight loss journey!",
			unitSystem: UnitSystem.IMPERIAL,
			currentWeight: 195.5,
			goalWeight: 175.0,
			targetDate: new Date("2025-06-01"),
			height: 70, // inches
			dateOfBirth: new Date("1990-05-15"),
			gender: Gender.MALE,
			activityLevel: ActivityLevel.MODERATELY_ACTIVE,
			profilePublic: true,
			weightVisible: true,
			emailVerified: true,
			isActive: true,
		},
	});

	const user2 = await prisma.user.create({
		data: {
			email: "jane@example.com",
			username: "janesmith",
			passwordHash,
			displayName: "Jane Smith",
			bio: "Marathon runner and health coach",
			unitSystem: UnitSystem.METRIC,
			currentWeight: 65.0,
			goalWeight: 60.0,
			targetDate: new Date("2025-04-01"),
			height: 165, // cm
			dateOfBirth: new Date("1988-09-22"),
			gender: Gender.FEMALE,
			activityLevel: ActivityLevel.VERY_ACTIVE,
			profilePublic: true,
			weightVisible: true,
			emailVerified: true,
			isActive: true,
		},
	});

	const user3 = await prisma.user.create({
		data: {
			email: "mike@example.com",
			username: "mikefit",
			passwordHash,
			displayName: "Mike Wilson",
			bio: "Beginner on my fitness journey",
			unitSystem: UnitSystem.IMPERIAL,
			currentWeight: 220.0,
			goalWeight: 190.0,
			height: 72,
			gender: Gender.MALE,
			activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
			profilePublic: true,
			weightVisible: false,
			emailVerified: true,
			isActive: true,
		},
	});

	console.log(
		"Created users:",
		user1.username,
		user2.username,
		user3.username,
	);

	// Create Weight Entries for User 1 (John - past 60 days, showing good progress)
	const weightEntries1: {
		userId: string;
		weight: number;
		bodyFatPercentage?: number;
		muscleMass?: number;
		waterPercentage?: number;
		notes?: string;
		visibility: EntryVisibility;
		recordedAt: Date;
	}[] = [];
	let weight1 = 210.5; // Starting weight
	const notes1 = [
		"Starting my journey!",
		"Feeling motivated",
		"Had a cheat day yesterday, back on track",
		"Great workout this morning",
		"Meal prep Sunday paid off",
		"Feeling stronger",
		"Hit the gym 5 times this week!",
		"Down another pound!",
		"Clothes are fitting better",
		"Energy levels are up",
		"Feeling great today!",
	];

	for (let i = 60; i >= 0; i--) {
		// Skip some days randomly to make it realistic (not every day)
		if (i > 0 && Math.random() < 0.3) continue;

		const date = new Date();
		date.setDate(date.getDate() - i);

		// Gradual weight loss with realistic fluctuations
		const dailyChange = Math.random() * 0.8 - 0.3; // Mostly losing, some gains
		weight1 = Math.max(190, weight1 - dailyChange * 0.3);

		const bodyFat = 24 - (60 - i) * 0.05 + (Math.random() * 0.5 - 0.25);

		weightEntries1.push({
			userId: user1.id,
			weight: Math.round(weight1 * 10) / 10,
			bodyFatPercentage: Math.round(bodyFat * 10) / 10,
			muscleMass:
				Math.round((weight1 * 0.42 + Math.random() * 2) * 10) / 10,
			waterPercentage: Math.round((52 + Math.random() * 4) * 10) / 10,
			notes:
				i === 0
					? notes1[notes1.length - 1]
					: Math.random() < 0.2
						? notes1[
								Math.floor(Math.random() * (notes1.length - 1))
							]
						: undefined,
			visibility: EntryVisibility.TEAM,
			recordedAt: date,
		});
	}
	await prisma.weightEntry.createMany({ data: weightEntries1 });

	// Update user1's current weight to match latest entry
	const latestWeight1 = weightEntries1[weightEntries1.length - 1].weight;
	await prisma.user.update({
		where: { id: user1.id },
		data: { currentWeight: latestWeight1 },
	});

	// Create Weight Entries for User 2 (Jane - past 30 days, metric system)
	const weightEntries2: {
		userId: string;
		weight: number;
		bodyFatPercentage?: number;
		notes?: string;
		visibility: EntryVisibility;
		recordedAt: Date;
	}[] = [];
	let weight2 = 67.5; // Starting weight in kg

	for (let i = 30; i >= 0; i--) {
		if (i > 0 && Math.random() < 0.25) continue;

		const date = new Date();
		date.setDate(date.getDate() - i);

		const dailyChange = Math.random() * 0.4 - 0.15;
		weight2 = Math.max(62, weight2 - dailyChange * 0.2);

		weightEntries2.push({
			userId: user2.id,
			weight: Math.round(weight2 * 10) / 10,
			bodyFatPercentage:
				Math.round((20 - (30 - i) * 0.03 + Math.random() * 0.3) * 10) /
				10,
			notes: i === 0 ? "Marathon training is going well!" : undefined,
			visibility: EntryVisibility.PUBLIC,
			recordedAt: date,
		});
	}
	await prisma.weightEntry.createMany({ data: weightEntries2 });

	// Update user2's current weight
	const latestWeight2 = weightEntries2[weightEntries2.length - 1].weight;
	await prisma.user.update({
		where: { id: user2.id },
		data: { currentWeight: latestWeight2 },
	});

	// Create Weight Entries for User 3 (Mike - just starting, past 14 days)
	const weightEntries3: {
		userId: string;
		weight: number;
		notes?: string;
		visibility: EntryVisibility;
		recordedAt: Date;
	}[] = [];
	let weight3 = 225.0; // Starting weight - heavier, just beginning

	for (let i = 14; i >= 0; i--) {
		if (i > 0 && Math.random() < 0.4) continue; // Less consistent logging

		const date = new Date();
		date.setDate(date.getDate() - i);

		const dailyChange = Math.random() * 0.6 - 0.2;
		weight3 = Math.max(218, weight3 - dailyChange * 0.25);

		weightEntries3.push({
			userId: user3.id,
			weight: Math.round(weight3 * 10) / 10,
			notes:
				i === 14
					? "Day 1 - Let's do this!"
					: i === 0
						? "Two weeks in, feeling hopeful"
						: undefined,
			visibility: EntryVisibility.PRIVATE,
			recordedAt: date,
		});
	}
	await prisma.weightEntry.createMany({ data: weightEntries3 });

	// Update user3's current weight
	const latestWeight3 = weightEntries3[weightEntries3.length - 1].weight;
	await prisma.user.update({
		where: { id: user3.id },
		data: { currentWeight: latestWeight3 },
	});

	console.log(
		`Created weight entries: ${weightEntries1.length} for John, ${weightEntries2.length} for Jane, ${weightEntries3.length} for Mike`,
	);

	// Create Teams
	const team1 = await prisma.team.create({
		data: {
			name: "Fitness Warriors",
			description:
				"A supportive community for people on their weight loss journey. Share tips, celebrate wins, and stay motivated!",
			isPublic: true,
			maxMembers: 100,
			ownerId: user1.id,
		},
	});

	// Add team members to Fitness Warriors
	await prisma.teamMember.createMany({
		data: [
			{ teamId: team1.id, userId: user1.id, role: TeamRole.OWNER },
			{ teamId: team1.id, userId: user2.id, role: TeamRole.ADMIN },
			{ teamId: team1.id, userId: user3.id, role: TeamRole.MEMBER },
		],
	});

	const team2 = await prisma.team.create({
		data: {
			name: "Beginner's Circle",
			description:
				"New to weight loss? Start here! A welcoming space for beginners to ask questions, learn the basics, and build healthy habits together. No judgment, just support!",
			isPublic: true,
			maxMembers: 50,
			ownerId: user3.id,
		},
	});

	// Add team members to Beginner's Circle
	await prisma.teamMember.createMany({
		data: [
			{ teamId: team2.id, userId: user3.id, role: TeamRole.OWNER },
			{ teamId: team2.id, userId: user1.id, role: TeamRole.MEMBER },
		],
	});

	const team3 = await prisma.team.create({
		data: {
			name: "Marathon Training Squad",
			description:
				"For runners training for marathons while managing weight and nutrition. Share training plans, race day tips, and fueling strategies. Let's go the distance!",
			isPublic: true,
			maxMembers: 30,
			ownerId: user2.id,
		},
	});

	// Add team members to Marathon Training Squad
	await prisma.teamMember.createMany({
		data: [
			{ teamId: team3.id, userId: user2.id, role: TeamRole.OWNER },
			{ teamId: team3.id, userId: user1.id, role: TeamRole.MODERATOR },
		],
	});

	const team4 = await prisma.team.create({
		data: {
			name: "Plant-Based Power",
			description:
				"Vegan and vegetarian athletes supporting each other. Share recipes, meal plans, and prove that plant-based eating supports peak performance!",
			isPublic: true,
			maxMembers: 75,
			ownerId: user2.id,
		},
	});

	// Add team members to Plant-Based Power
	await prisma.teamMember.createMany({
		data: [
			{ teamId: team4.id, userId: user2.id, role: TeamRole.OWNER },
		],
	});

	const team5 = await prisma.team.create({
		data: {
			name: "The Accountability Crew",
			description:
				"Private group for serious commitment. Daily check-ins required. Weekly challenges. Monthly goals. We hold each other accountable - no excuses!",
			isPublic: false,
			maxMembers: 20,
			ownerId: user1.id,
		},
	});

	// Add team members to Accountability Crew
	await prisma.teamMember.createMany({
		data: [
			{ teamId: team5.id, userId: user1.id, role: TeamRole.OWNER },
			{ teamId: team5.id, userId: user2.id, role: TeamRole.ADMIN },
			{ teamId: team5.id, userId: user3.id, role: TeamRole.MEMBER },
		],
	});

	console.log(
		"Created teams:",
		team1.name,
		team2.name,
		team3.name,
		team4.name,
		team5.name,
	);

	// Create Posts
	const post1 = await prisma.post.create({
		data: {
			authorId: user1.id,
			teamId: team1.id,
			type: PostType.MILESTONE,
			visibility: PostVisibility.TEAM,
			title: "Hit my first 10 pounds lost!",
			content:
				"So excited to share that I have officially lost 10 pounds since starting my journey! The key has been consistency and tracking my progress daily. Thanks to everyone in this group for the support!",
			tags: ["milestone", "weightloss", "celebration"],
		},
	});

	const post2 = await prisma.post.create({
		data: {
			authorId: user2.id,
			teamId: team1.id,
			type: PostType.TIP,
			visibility: PostVisibility.TEAM,
			title: "My favorite healthy breakfast recipes",
			content:
				"Here are 5 quick and healthy breakfast ideas that have helped me stay on track:\n\n1. Greek yogurt with berries and granola\n2. Overnight oats with banana and almond butter\n3. Veggie egg scramble\n4. Smoothie bowl with spinach and protein powder\n5. Avocado toast on whole grain bread\n\nWhat are your go-to breakfasts?",
			tags: ["tips", "nutrition", "breakfast", "recipes"],
		},
	});

	const post3 = await prisma.post.create({
		data: {
			authorId: user3.id,
			type: PostType.QUESTION,
			visibility: PostVisibility.PUBLIC,
			title: "Best time to weigh yourself?",
			content:
				"I have been getting inconsistent readings on my scale. When do you all typically weigh yourselves? Morning? After workouts? I want to track my progress more accurately.",
			tags: ["question", "tracking", "beginner"],
		},
	});

	console.log("Created posts");

	// Create Comments
	await prisma.comment.create({
		data: {
			postId: post1.id,
			authorId: user2.id,
			content:
				"Congratulations John! That is amazing progress. Keep up the great work!",
		},
	});

	await prisma.comment.create({
		data: {
			postId: post1.id,
			authorId: user3.id,
			content:
				"This is so inspiring! I hope to hit that milestone soon too.",
		},
	});

	const comment3 = await prisma.comment.create({
		data: {
			postId: post3.id,
			authorId: user1.id,
			content:
				"I always weigh myself first thing in the morning, after using the bathroom but before eating or drinking anything. This gives me the most consistent readings.",
		},
	});

	// Create a reply to comment
	await prisma.comment.create({
		data: {
			postId: post3.id,
			authorId: user2.id,
			parentId: comment3.id,
			content:
				"Same here! Morning weigh-ins are the most accurate. Also try to weigh yourself at the same time each day.",
		},
	});

	console.log("Created comments");

	// Create Likes
	await prisma.like.createMany({
		data: [
			{ postId: post1.id, userId: user2.id },
			{ postId: post1.id, userId: user3.id },
			{ postId: post2.id, userId: user1.id },
			{ postId: post2.id, userId: user3.id },
			{ postId: post3.id, userId: user1.id },
		],
	});

	console.log("Created likes");

	// Create Challenge
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - 7); // Started a week ago
	const endDate = new Date();
	endDate.setDate(endDate.getDate() + 23); // Ends in 23 days (30 day challenge)

	const challenge = await prisma.challenge.create({
		data: {
			name: "30-Day Weight Loss Challenge",
			description:
				"Lose as much weight as possible in 30 days! Track your progress daily and support each other. Top 3 participants (by percentage lost) will be featured on our team page!",
			type: ChallengeType.WEIGHT_LOSS_PERCENTAGE,
			status: ChallengeStatus.ACTIVE,
			startDate,
			endDate,
			targetValue: 5.0, // 5% body weight
			rewardPoints: 500,
			teamId: team1.id,
		},
	});

	// Add challenge participants
	await prisma.challengeParticipant.createMany({
		data: [
			{ challengeId: challenge.id, userId: user1.id, progress: 2.5 },
			{ challengeId: challenge.id, userId: user2.id, progress: 1.8 },
			{ challengeId: challenge.id, userId: user3.id, progress: 1.2 },
		],
	});

	console.log("Created challenge:", challenge.name);

	// Create Achievements
	await prisma.achievement.createMany({
		data: [
			{
				name: "First Steps",
				description: "Log your first weight entry",
				points: 10,
			},
			{
				name: "Week Warrior",
				description: "Log weight for 7 consecutive days",
				points: 50,
			},
			{
				name: "Month Master",
				description: "Log weight for 30 consecutive days",
				points: 200,
			},
			{
				name: "5 Pounds Down",
				description: "Lose 5 pounds from starting weight",
				points: 100,
			},
			{
				name: "10 Pounds Down",
				description: "Lose 10 pounds from starting weight",
				points: 250,
			},
			{
				name: "Team Player",
				description: "Join your first team",
				points: 25,
			},
			{
				name: "Social Butterfly",
				description: "Create your first post",
				points: 15,
			},
			{
				name: "Helpful Hand",
				description: "Comment on 10 posts",
				points: 50,
			},
			{
				name: "Challenge Accepted",
				description: "Join your first challenge",
				points: 30,
			},
			{
				name: "Challenge Champion",
				description: "Complete a challenge",
				points: 300,
			},
		],
	});

	const allAchievements = await prisma.achievement.findMany();

	// Assign some achievements to users
	await prisma.userAchievement.createMany({
		data: [
			{ userId: user1.id, achievementId: allAchievements[0].id }, // First Steps
			{ userId: user1.id, achievementId: allAchievements[1].id }, // Week Warrior
			{ userId: user1.id, achievementId: allAchievements[2].id }, // Month Master
			{ userId: user1.id, achievementId: allAchievements[3].id }, // 5 Pounds Down
			{ userId: user1.id, achievementId: allAchievements[4].id }, // 10 Pounds Down
			{ userId: user1.id, achievementId: allAchievements[5].id }, // Team Player
			{ userId: user1.id, achievementId: allAchievements[6].id }, // Social Butterfly
			{ userId: user1.id, achievementId: allAchievements[8].id }, // Challenge Accepted
			{ userId: user2.id, achievementId: allAchievements[0].id }, // First Steps
			{ userId: user2.id, achievementId: allAchievements[1].id }, // Week Warrior
			{ userId: user2.id, achievementId: allAchievements[5].id }, // Team Player
			{ userId: user2.id, achievementId: allAchievements[6].id }, // Social Butterfly
			{ userId: user2.id, achievementId: allAchievements[8].id }, // Challenge Accepted
			{ userId: user3.id, achievementId: allAchievements[0].id }, // First Steps
			{ userId: user3.id, achievementId: allAchievements[5].id }, // Team Player
			{ userId: user3.id, achievementId: allAchievements[8].id }, // Challenge Accepted
		],
	});

	console.log("Created achievements and user achievements");

	// Create a Conversation
	const conversation = await prisma.conversation.create({
		data: {
			name: "Fitness Warriors Chat",
			isGroup: true,
			teamId: team1.id,
		},
	});

	await prisma.conversationParticipant.createMany({
		data: [
			{ conversationId: conversation.id, userId: user1.id },
			{ conversationId: conversation.id, userId: user2.id },
			{ conversationId: conversation.id, userId: user3.id },
		],
	});

	// Create some messages
	const messageData = [
		{
			conversationId: conversation.id,
			senderId: user1.id,
			content: "Hey everyone! Welcome to our team chat.",
		},
		{
			conversationId: conversation.id,
			senderId: user2.id,
			content: "Thanks for setting this up John! Excited to be here.",
		},
		{
			conversationId: conversation.id,
			senderId: user3.id,
			content: "Hi all! Looking forward to this journey together.",
		},
		{
			conversationId: conversation.id,
			senderId: user1.id,
			content:
				"Remember to log your weight daily! It really helps with accountability.",
		},
		{
			conversationId: conversation.id,
			senderId: user2.id,
			content:
				"Good tip! I also find meal prepping on Sundays super helpful.",
		},
	];

	for (const msg of messageData) {
		await prisma.message.create({ data: msg });
		await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for different timestamps
	}

	console.log("Created conversation and messages");

	console.log("\n✅ Database seeded successfully!");
	console.log("\nSample login credentials:");
	console.log("  - john@example.com (johndoe)");
	console.log("  - jane@example.com (janesmith)");
	console.log("  - mike@example.com (mikefit)");
	console.log(`  Password: ${DEFAULT_PASSWORD}`);
}

main()
	.catch((e) => {
		console.error("Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
