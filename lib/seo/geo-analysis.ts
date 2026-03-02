import { prisma } from '@/lib/db/prisma'

export interface AiBotStatus {
  name: string
  userAgent: string
  allowed: boolean
  scope: string
}

export interface StructuredDataCoverage {
  pageType: string
  hasSchema: boolean
  schemaTypes: string[]
}

export interface ContentQualityMetrics {
  totalPosts: number
  avgWordCount: number
  postsOver1000Words: number
  postsWithKeywords: number
  postsWithCategories: number
  postsWithFeaturedImages: number
}

export interface GeoAnalysisResult {
  aiBots: AiBotStatus[]
  llmsTxtContent: string
  llmsTxtSource: 'admin_settings' | 'static_file'
  structuredDataCoverage: StructuredDataCoverage[]
  contentQuality: ContentQualityMetrics
  rssFeedStatus: {
    exists: boolean
    path: string
  }
  geoScore: number
}

// AI bots configured in robots.ts
const AI_BOTS: AiBotStatus[] = [
  { name: 'GPTBot (OpenAI)', userAgent: 'GPTBot', allowed: true, scope: 'Public pages only' },
  { name: 'ChatGPT-User', userAgent: 'ChatGPT-User', allowed: true, scope: 'Public pages only' },
  { name: 'ClaudeBot (Anthropic)', userAgent: 'ClaudeBot', allowed: true, scope: 'Public pages only' },
  { name: 'Claude-Web', userAgent: 'Claude-Web', allowed: true, scope: 'Public pages only' },
  { name: 'PerplexityBot', userAgent: 'PerplexityBot', allowed: true, scope: 'Public pages only' },
  { name: 'Google-Extended', userAgent: 'Google-Extended', allowed: true, scope: 'Public pages only' },
  { name: 'CCBot (Common Crawl)', userAgent: 'CCBot', allowed: true, scope: 'Public pages only' },
  { name: 'Applebot-Extended', userAgent: 'Applebot-Extended', allowed: true, scope: 'Public pages only' },
  { name: 'Cohere AI', userAgent: 'cohere-ai', allowed: true, scope: 'Public pages only' },
]

const STRUCTURED_DATA_COVERAGE: StructuredDataCoverage[] = [
  { pageType: 'Homepage', hasSchema: true, schemaTypes: ['Organization', 'WebApplication', 'WebsiteSearch'] },
  { pageType: 'Blog Posts', hasSchema: true, schemaTypes: ['BlogPosting', 'BreadcrumbList'] },
  { pageType: 'Debate Detail', hasSchema: true, schemaTypes: ['DiscussionForumPosting', 'BreadcrumbList'] },
  { pageType: 'FAQ Page', hasSchema: true, schemaTypes: ['FAQPage'] },
  { pageType: 'How It Works', hasSchema: true, schemaTypes: ['HowTo'] },
  { pageType: 'Pricing', hasSchema: true, schemaTypes: ['Product', 'Offer'] },
  { pageType: 'About', hasSchema: true, schemaTypes: ['AboutPage'] },
  { pageType: 'User Profiles', hasSchema: true, schemaTypes: ['Person'] },
  { pageType: 'Tournaments', hasSchema: true, schemaTypes: ['Event', 'VirtualLocation'] },
  { pageType: 'Debates Listing', hasSchema: true, schemaTypes: ['CollectionPage', 'ItemList'] },
]

const DEFAULT_LLMS_TXT = `# ArguFight

> The world's first debate platform with AI judges.

## Key Pages
- Homepage: https://www.argufight.com
- Browse Debates: https://www.argufight.com/debates
- Leaderboard: https://www.argufight.com/leaderboard
- Blog: https://www.argufight.com/blog

## API and Feeds
- Sitemap: https://www.argufight.com/sitemap.xml
- RSS Feed: https://www.argufight.com/feed.xml
`

export async function getGeoAnalysis(): Promise<GeoAnalysisResult> {
  // Get llms.txt content
  const llmsSetting = await prisma.adminSetting.findUnique({
    where: { key: 'seo_geo_llms_txt_content' },
  })
  const llmsTxtContent = llmsSetting?.value || DEFAULT_LLMS_TXT
  const llmsTxtSource = llmsSetting?.value ? 'admin_settings' as const : 'static_file' as const

  // Get content quality metrics
  const totalPosts = await prisma.blogPost.count({
    where: { status: 'PUBLISHED' },
  })

  const allPosts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      content: true,
      keywords: true,
      featuredImageId: true,
      categories: { select: { categoryId: true } },
    },
  })

  const wordCounts = allPosts.map(
    (p) => p.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  )
  const avgWordCount =
    wordCounts.length > 0
      ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
      : 0
  const postsOver1000Words = wordCounts.filter((w) => w >= 1000).length
  const postsWithKeywords = allPosts.filter((p) => p.keywords && p.keywords.trim()).length
  const postsWithCategories = allPosts.filter((p) => p.categories.length > 0).length
  const postsWithFeaturedImages = allPosts.filter((p) => p.featuredImageId).length

  // Calculate GEO score
  let geoScore = 50 // Base score
  // llms.txt exists: +10
  geoScore += 10
  // AI bots allowed: +10
  geoScore += 10
  // Structured data coverage: +10 if >= 80%
  const coveragePercent =
    STRUCTURED_DATA_COVERAGE.filter((s) => s.hasSchema).length /
    STRUCTURED_DATA_COVERAGE.length
  if (coveragePercent >= 0.8) geoScore += 10
  // RSS feed: +5
  geoScore += 5
  // Content quality bonuses
  if (avgWordCount >= 500) geoScore += 5
  if (totalPosts > 0 && postsWithKeywords / totalPosts > 0.5) geoScore += 5
  if (totalPosts > 0 && postsWithCategories / totalPosts > 0.5) geoScore += 5
  geoScore = Math.min(100, geoScore)

  return {
    aiBots: AI_BOTS,
    llmsTxtContent,
    llmsTxtSource,
    structuredDataCoverage: STRUCTURED_DATA_COVERAGE,
    contentQuality: {
      totalPosts,
      avgWordCount,
      postsOver1000Words,
      postsWithKeywords,
      postsWithCategories,
      postsWithFeaturedImages,
    },
    rssFeedStatus: {
      exists: true,
      path: '/feed.xml',
    },
    geoScore,
  }
}
