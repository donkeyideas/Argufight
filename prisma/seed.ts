import { PrismaClient } from '@prisma/client'
import { JUDGE_PERSONALITIES } from '../lib/ai/judges'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing judges
  await prisma.judge.deleteMany()

  // Create judges
  for (const judge of JUDGE_PERSONALITIES) {
    await prisma.judge.create({
      data: {
        name: judge.name,
        personality: judge.personality,
        emoji: judge.emoji,
        description: judge.description,
        systemPrompt: judge.systemPrompt,
      },
    })
    console.log(`Created judge: ${judge.name} ${judge.emoji}`)
  }

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

