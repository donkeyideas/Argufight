import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/prisma'

// Cache homepage sections for 10 minutes (survives Vercel cold starts)
const getCachedHomepageSections = unstable_cache(
  async () => {
    return prisma.homepageSection.findMany({
      where: { isVisible: true },
      include: {
        images: { orderBy: { order: 'asc' } },
        buttons: { where: { isVisible: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    })
  },
  ['homepage-api-sections'],
  { revalidate: 600, tags: ['homepage-sections'] }
)

// GET /api/homepage/content - Get public homepage content
export async function GET() {
  try {
    const sections = await getCachedHomepageSections()
    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Failed to fetch homepage content:', error)
    return NextResponse.json({
      sections: [
        {
          id: 'default-hero',
          key: 'hero',
          title: 'Welcome to Honorable AI',
          content: '<p>The world\'s first AI-judged debate platform. Engage in structured debates and get judged by AI personalities.</p>',
          order: 0,
          isVisible: true,
          images: [],
          buttons: [
            {
              id: 'default-signup',
              text: 'Get Started',
              url: '/signup',
              variant: 'primary',
              order: 0,
              isVisible: true,
            },
            {
              id: 'default-login',
              text: 'Login',
              url: '/login',
              variant: 'secondary',
              order: 1,
              isVisible: true,
            },
          ],
        },
      ],
    })
  }
}
