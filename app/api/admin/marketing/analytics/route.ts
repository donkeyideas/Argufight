import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/marketing/analytics - Get marketing analytics
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0) // All time
    }

    // Get counts of content
    const [socialPosts, blogPosts, newsletters] = await Promise.all([
      prisma.socialMediaPost.count({
        where: {
          createdAt: { gte: startDate },
          status: 'PUBLISHED',
        },
      }),
      prisma.blogPost.count({
        where: {
          createdAt: { gte: startDate },
          status: 'PUBLISHED',
        },
      }),
      prisma.emailNewsletter.count({
        where: {
          createdAt: { gte: startDate },
          status: 'SENT',
        },
      }),
    ])

    // Get analytics data from ContentAnalytics table
    const analytics = await prisma.contentAnalytics.findMany({
      where: {
        recordedAt: { gte: startDate },
      },
      include: {
        socialPost: {
          select: {
            id: true,
            content: true,
            platform: true,
          },
        },
        blogPost: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    // Aggregate metrics
    let totalImpressions = 0
    let totalEngagement = 0
    const contentMetrics = new Map<string, {
      id: string
      contentType: string
      title: string
      impressions: number
      engagement: number
    }>()
    const platformStats = new Map<string, {
      platform: string
      posts: number
      impressions: number
      engagement: number
    }>()

    analytics.forEach((metric) => {
      // Calculate engagement (likes + comments + shares + clicks)
      const engagement = (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.clicks || 0)
      
      totalImpressions += metric.impressions || 0
      totalEngagement += engagement

      // Track by content
      let contentId: string | null = null
      let contentType = ''
      let title = ''

      if (metric.socialPost) {
        contentId = metric.socialPost.id
        contentType = 'SOCIAL_POST'
        title = metric.socialPost.content.substring(0, 50) || 'Social Post'
        
        // Track platform stats
        const platform = metric.socialPost.platform
        if (!platformStats.has(platform)) {
          platformStats.set(platform, {
            platform,
            posts: 0,
            impressions: 0,
            engagement: 0,
          })
        }
        const platformStat = platformStats.get(platform)!
        platformStat.impressions += metric.impressions || 0
        platformStat.engagement += engagement
      } else if (metric.blogPost) {
        contentId = metric.blogPost.id
        contentType = 'BLOG_POST'
        title = metric.blogPost.title
      }

      if (contentId) {
        if (!contentMetrics.has(contentId)) {
          contentMetrics.set(contentId, {
            id: contentId,
            contentType,
            title,
            impressions: 0,
            engagement: 0,
          })
        }
        const contentMetric = contentMetrics.get(contentId)!
        contentMetric.impressions += metric.impressions || 0
        contentMetric.engagement += engagement
      }
    })

    // Count posts per platform
    const platformPostCounts = await prisma.socialMediaPost.groupBy({
      by: ['platform'],
      where: {
        createdAt: { gte: startDate },
        status: 'PUBLISHED',
      },
      _count: true,
    })

    platformPostCounts.forEach(({ platform, _count }) => {
      if (!platformStats.has(platform)) {
        platformStats.set(platform, {
          platform,
          posts: 0,
          impressions: 0,
          engagement: 0,
        })
      }
      platformStats.get(platform)!.posts = _count
    })

    // Get top performing content
    const topPosts = Array.from(contentMetrics.values())
      .map((content) => ({
        ...content,
        engagementRate: content.impressions > 0
          ? (content.engagement / content.impressions) * 100
          : 0,
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10)

    return NextResponse.json({
      totalPosts: socialPosts,
      totalBlogPosts: blogPosts,
      totalNewsletters: newsletters,
      totalImpressions,
      totalEngagement,
      topPosts,
      platformStats: Array.from(platformStats.values()),
    })
  } catch (error: any) {
    console.error('Failed to fetch analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

