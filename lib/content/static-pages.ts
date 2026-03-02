import { prisma } from '@/lib/db/prisma'

export interface StaticPageData {
  id: string
  slug: string
  title: string
  content: string
  metaTitle: string | null
  metaDescription: string | null
  keywords: string | null
  isVisible: boolean
}

export async function getStaticPage(slug: string): Promise<StaticPageData | null> {
  try {
    const page = await prisma.staticPage.findUnique({
      where: { slug, isVisible: true },
    })
    return page
  } catch (error) {
    console.error(`Failed to fetch static page ${slug}:`, error)
    return null
  }
}

