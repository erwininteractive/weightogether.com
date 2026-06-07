# Achievements System Design

## Overview

The achievements system rewards users for reaching weight loss milestones, maintaining consistency, and engaging with the platform. Achievements are automatically awarded when conditions are met.

## Achievement Types

### 1. Weight Loss Milestones
- **First Weigh-In** - Log your first weight entry
- **5 lbs Lost** - Lose 5 pounds from starting weight
- **10 lbs Lost** - Lose 10 pounds from starting weight
- **25 lbs Lost** - Lose 25 pounds from starting weight
- **50 lbs Lost** - Lose 50 pounds from starting weight
- **100 lbs Lost** - Lose 100 pounds from starting weight
- **Goal Reached** - Reach your goal weight

### 2. Consistency Streaks
- **Week Warrior** - Log weight 7 days in a row
- **Monthly Consistent** - Log weight at least once per week for 4 weeks
- **100 Day Streak** - Log weight 100 days in a row
- **Year of Progress** - Log weight for 365 days

### 3. Engagement
- **Team Player** - Join your first team
- **Social Butterfly** - Make your first post
- **Challenger** - Join your first challenge
- **Motivator** - Receive 10 likes on posts
- **Helpful** - Make 25 comments

### 4. Body Composition (if tracking)
- **Body Fat Champion** - Reduce body fat % by 5%
- **Muscle Builder** - Increase muscle mass by 10 lbs
- **Hydration Hero** - Maintain 60%+ water percentage for 30 days

### 5. Special Achievements
- **Early Adopter** - One of the first 100 users
- **Beta Tester** - Used the app during beta
- **Supporter** - Made a donation
- **Monthly Supporter** - Active monthly subscription

## Achievement Properties

Each achievement has:
- **Name**: Display name (e.g., "5 lbs Lost")
- **Description**: What the user accomplished
- **Icon**: Emoji or URL to icon image
- **Points**: Reward points (for future gamification)
- **Type**: Category (WEIGHT_LOSS, CONSISTENCY, ENGAGEMENT, SPECIAL)
- **Tier**: BRONZE, SILVER, GOLD, PLATINUM (for progressive achievements)

## Automatic Award Triggers

Achievements are checked and awarded automatically when:

1. **Weight Entry Created/Updated**
   - Check weight loss milestones
   - Check consistency streaks
   - Check body composition goals

2. **Team Joined**
   - Award "Team Player"

3. **Post Created**
   - Award "Social Butterfly" (first post)
   - Check "Motivator" when post receives likes

4. **Comment Created**
   - Check "Helpful" (25 comments)

5. **Challenge Joined**
   - Award "Challenger"

6. **Donation Made**
   - Award "Supporter" or "Monthly Supporter"

## Database Schema (Already Exists)

```prisma
model Achievement {
  id          String   @id @default(uuid())
  name        String   @unique
  description String
  iconUrl     String?
  points      Int      @default(0)
  createdAt   DateTime @default(now())

  userAchievements UserAchievement[]
}

model UserAchievement {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(...)
  achievementId String
  achievement   Achievement @relation(...)
  unlockedAt    DateTime    @default(now())

  @@unique([userId, achievementId])
}
```

## Implementation Plan

1. **Seed Default Achievements**
   - Create 20-30 default achievements in seed script
   - Include name, description, icon (emoji), points

2. **AchievementService**
   - `checkAndAwardAchievements(userId, trigger)` - Main method
   - `awardAchievement(userId, achievementName)` - Award single achievement
   - `getUserAchievements(userId)` - Get user's achievements
   - `getAvailableAchievements(userId)` - Get locked achievements with progress
   - `calculateProgress(userId, achievementName)` - Progress toward achievement

3. **Achievement Triggers**
   - Weight entry hooks in WeightController
   - Team join hooks in TeamController
   - Post/comment hooks in PostController
   - Challenge join hooks in ChallengeController

4. **UI Components**
   - Achievement card component
   - Progress bars for locked achievements
   - Achievement notification toast
   - Profile achievements section
   - Dedicated achievements page

## User Experience

### When Achievement Unlocked
1. Achievement is saved to database
2. User sees toast notification: "🎉 Achievement Unlocked: 5 lbs Lost!"
3. Achievement appears in profile
4. Points are added to user's total (future: leaderboard)

### Viewing Achievements
- **Profile Page**: Shows top 3-5 recent achievements
- **Achievements Page**: Shows all unlocked and progress on locked ones
- **Other Users**: Can see achievements on public profiles (if enabled)

## Future Enhancements

- **Custom Achievements**: Admins can create custom achievements
- **Hidden Achievements**: Secret achievements users discover
- **Point Rewards**: Redeem points for profile themes, badges
- **Leaderboards**: Top achievement earners
- **Notifications**: Email/push for achievement unlocks
- **Share**: Share achievements on social media
