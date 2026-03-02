/**
 * Seed default belt settings for all belt types
 * Run: npx tsx prisma/seed-belt-settings.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🌱 Seeding belt settings...\n')

  const beltTypes = ['ROOKIE', 'CATEGORY', 'CHAMPIONSHIP', 'UNDEFEATED', 'TOURNAMENT'] as const

  for (const type of beltTypes) {
    const settings = await prisma.beltSettings.upsert({
      where: { beltType: type },
      update: {},
      create: {
        beltType: type,
        // Defense periods (in days)
        defensePeriodDays: 30,
        inactivityDays: 30,
        mandatoryDefenseDays: 60,
        gracePeriodDays: 30,
        
        // Challenge rules
        maxDeclines: 2,
        challengeCooldownDays: 7,
        challengeExpiryDays: 3,
        freeChallengesPerWeek: 1,
        
        // ELO matching (anti-abuse)
        eloRange: 200,
        activityRequirementDays: 30,
        winStreakBonusMultiplier: 1.2,
        
        // Coin economics
        entryFeeBase: 100,
        entryFeeMultiplier: 1.0,
        winnerRewardPercent: 60,
        loserConsolationPercent: 30,
        platformFeePercent: 10,
        
        // Tournament belt creation costs
        tournamentBeltCostSmall: 500,  // 8 players
        tournamentBeltCostMedium: 1000, // 16 players
        tournamentBeltCostLarge: 2000,  // 32+ players
        
        // Inactive belt rules
        inactiveCompetitorCount: 2,
        inactiveAcceptDays: 7,
      },
    })

    console.log(`✅ ${type} belt settings created/updated`)
  }

  console.log('\n✨ Belt settings seeded successfully!\n')
}

main()
  .catch((error) => {
    console.error('❌ Error seeding belt settings:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
