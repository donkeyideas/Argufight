import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding homepage sections...')

  // Create default homepage sections
  const sections = [
    {
      key: 'hero',
      title: 'Welcome to Honorable AI',
      content: '<p>The world\'s first AI-judged debate platform. Engage in structured debates and get judged by AI personalities.</p>',
      order: 0,
      isVisible: true,
      metaTitle: 'Honorable AI - AI-Judged Debate Platform',
      metaDescription: 'Engage in structured debates judged by AI personalities. Climb the ELO leaderboard and prove your argumentation skills.',
    },
    {
      key: 'features',
      title: 'Features',
      content: '<p>Discover what makes Honorable AI unique:</p><ul><li>AI-powered judges with distinct personalities</li><li>ELO ranking system</li><li>Structured debate format</li><li>Real-time chat and engagement</li></ul>',
      order: 1,
      isVisible: true,
    },
    {
      key: 'how-it-works',
      title: 'How It Works',
      content: '<p>1. Create or accept a debate challenge<br/>2. Submit your arguments over 5 rounds<br/>3. Get judged by AI personalities<br/>4. Climb the ELO leaderboard</p>',
      order: 2,
      isVisible: true,
    },
    {
      key: 'testimonials',
      title: 'What Users Say',
      content: '<p>Join thousands of debaters who are improving their argumentation skills every day.</p>',
      order: 3,
      isVisible: true,
    },
    {
      key: 'app-download',
      title: 'Download Our App',
      content: '<p>Get the Honorable AI app on your mobile device and debate on the go!</p>',
      order: 4,
      isVisible: true,
    },
    {
      key: 'footer',
      title: null,
      content: null, // Footer content is now hardcoded in FooterSection component
      order: 999,
      isVisible: true,
    },
  ]

  for (const section of sections) {
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      update: section,
      create: section,
    })
    console.log(`✓ Created/updated section: ${section.key}`)
  }

  console.log('Homepage sections seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

