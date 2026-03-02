import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get latest audit
    const latestAudit = await prisma.seoAudit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        overallScore: true,
        technicalScore: true,
        contentScore: true,
        performanceScore: true,
        geoScore: true,
        totalIssues: true,
        criticalIssues: true,
        createdAt: true,
      },
    })

    // Get recommendation counts
    const recCounts = await prisma.seoRecommendation.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const statusCounts = { pending: 0, implemented: 0, dismissed: 0 }
    for (const c of recCounts) {
      if (c.status in statusCounts) {
        statusCounts[c.status as keyof typeof statusCounts] = c._count.id
      }
    }

    // Estimate indexed pages
    const [publicDebates, publishedBlogs, publicTournaments] = await Promise.all([
      prisma.debate.count({
        where: { visibility: 'PUBLIC', status: { in: ['COMPLETED', 'ACTIVE'] } },
      }),
      prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
      prisma.tournament.count({ where: { isPrivate: false } }),
    ])
    const estimatedIndexedPages = publicDebates + publishedBlogs + publicTournaments + 10

    // Get audit history for trend chart
    const auditHistory = await prisma.seoAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        overallScore: true,
        technicalScore: true,
        contentScore: true,
        geoScore: true,
        createdAt: true,
      },
    })

    // Get issues by category from latest audit
    const issuesByCategory = latestAudit
      ? {
          technical: 0,
          content: 0,
          performance: 0,
          geo: 0,
        }
      : null

    if (latestAudit) {
      const fullAudit = await prisma.seoAudit.findUnique({
        where: { id: latestAudit.id },
      })
      if (fullAudit?.results) {
        const results = fullAudit.results as Record<string, unknown>
        const categories = results.categories as Record<
          string,
          { issues?: unknown[] }
        > | undefined
        if (categories && issuesByCategory) {
          issuesByCategory.technical = categories.technical?.issues?.length || 0
          issuesByCategory.content = categories.content?.issues?.length || 0
          issuesByCategory.performance = categories.performance?.issues?.length || 0
          issuesByCategory.geo = categories.geo?.issues?.length || 0
        }
      }
    }

    return NextResponse.json({
      latestAudit,
      statusCounts,
      estimatedIndexedPages,
      auditHistory: auditHistory.reverse(),
      issuesByCategory,
    })
  } catch (error) {
    console.error('Error fetching overview:', error)
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 })
  }
}
