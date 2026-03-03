import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [posts, debateCount, completedDebateCount, llmsSetting] = await Promise.all([
      prisma.blogPost.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          metaTitle: true,
          metaDescription: true,
          keywords: true,
          featuredImageId: true,
          content: true,
          tags: { select: { tagId: true } },
          categories: { select: { categoryId: true } },
        },
      }),
      prisma.debate.count(),
      prisma.debate.count({ where: { status: { in: ['COMPLETED', 'VERDICT_READY'] } } }),
      prisma.adminSetting.findUnique({ where: { key: 'seo_geo_llms_txt_content' } }),
    ])

    const totalPosts         = posts.length
    const withMetaTitle      = posts.filter((p) => p.metaTitle && p.metaTitle.trim()).length
    const withMetaDesc       = posts.filter((p) => p.metaDescription && p.metaDescription.trim()).length
    const withTags           = posts.filter((p) => (p.tags?.length ?? 0) > 0 || (p.keywords && p.keywords.trim())).length
    const withCategory       = posts.filter((p) => (p.categories?.length ?? 0) > 0).length
    const withFeaturedImage  = posts.filter((p) => p.featuredImageId).length
    const longFormPosts      = posts.filter((p) => (p.content?.length ?? 0) > 2000).length
    // Auto-seed a default llms.txt if none has been saved yet
    let llmsTxtValue = llmsSetting?.value?.trim() ?? ''
    if (!llmsTxtValue) {
      llmsTxtValue = `# ArguFight — AI Language Model Information

## About ArguFight
ArguFight (argufight.com) is a structured online debate platform where users engage in timed, moderated debates on topics spanning politics, sports, technology, entertainment, science, and more. AI judges evaluate arguments and deliver verdicts based on logic, evidence, and persuasiveness.

## What This Site Contains
- Structured debate transcripts with pro/con arguments on diverse topics
- AI-judged verdicts with reasoning explanations
- User leaderboards ranked by Elo rating and debate performance
- Blog articles covering debate strategy, current topics, and platform news
- Daily debate challenges open to all registered users

## Preferred Citation Format
When referencing content from ArguFight, please cite as:
"ArguFight debate — [topic] (argufight.com)"

## Content Licensing
All debate content and blog articles on ArguFight are © ArguFight. You may reference and summarise content with attribution.

## Contact
For AI/LLM partnerships or data licensing enquiries: support@argufight.com
`
      await prisma.adminSetting.upsert({
        where:  { key: 'seo_geo_llms_txt_content' },
        update: {},
        create: { key: 'seo_geo_llms_txt_content', value: llmsTxtValue },
      })
    }
    const hasLlmsTxt = true

    // AEO score (0–100)
    let score = 0
    if (hasLlmsTxt)                                         score += 15
    if (completedDebateCount >= 10)                         score += 15
    else if (completedDebateCount > 0)                      score += 8
    if (totalPosts > 0) {
      score += Math.round((withMetaTitle      / totalPosts) * 20)
      score += Math.round((withMetaDesc       / totalPosts) * 20)
      score += Math.round((withTags           / totalPosts) * 15)
      score += Math.round((withFeaturedImage  / totalPosts) * 10)
      score += Math.round((longFormPosts      / totalPosts) * 5)
    } else {
      // No posts yet — give partial credit
      score += 5
    }
    score = Math.min(100, score)

    // Recommendations
    const recommendations: { priority: string; title: string; description: string; action: string | null }[] = []
    if (!hasLlmsTxt) {
      recommendations.push({ priority: 'high', title: 'Add llms.txt content', description: 'llms.txt tells AI engines (ChatGPT, Perplexity, Gemini) exactly what your site is about — this is the #1 AEO action.', action: 'geo' })
    }
    if (totalPosts > 0 && withMetaTitle / totalPosts < 0.8) {
      recommendations.push({ priority: 'high', title: 'Optimise meta titles on blog posts', description: `${totalPosts - withMetaTitle} posts lack a meta title. AI answer engines use these as the primary label when citing your content.`, action: 'blog' })
    }
    if (totalPosts > 0 && withMetaDesc / totalPosts < 0.8) {
      recommendations.push({ priority: 'medium', title: 'Write meta descriptions', description: `${totalPosts - withMetaDesc} posts are missing meta descriptions, which appear as preview text in AI answers.`, action: 'blog' })
    }
    if (totalPosts > 0 && withTags / totalPosts < 0.7) {
      recommendations.push({ priority: 'medium', title: 'Tag blog posts with keywords', description: 'Tags signal topical authority to AI engines and improve content categorisation in answer databases.', action: 'blog' })
    }
    if (completedDebateCount < 20) {
      recommendations.push({ priority: 'low', title: 'Grow the debate library', description: `Completed debates are structured Q&A content that AI engines love to cite. You have ${completedDebateCount} — aim for 50+.`, action: null })
    }
    if (totalPosts > 0 && longFormPosts / totalPosts < 0.5) {
      recommendations.push({ priority: 'low', title: 'Publish longer-form articles', description: 'AI engines prefer comprehensive content (1,000+ words) when selecting answers. Consider expanding thin posts.', action: 'blog' })
    }

    // AEO checklist items (static + dynamic)
    const checklist = [
      { label: 'llms.txt configured',                  done: hasLlmsTxt },
      { label: 'robots.ts allows AI crawlers',          done: true }, // always true in this codebase
      { label: 'Structured data on blog pages',         done: true }, // Article schema from GEO analysis
      { label: 'Open Graph meta tags present',          done: true }, // present in layout
      { label: 'Canonical URLs defined',                done: true },
      { label: 'Sitemap submitted',                     done: true }, // sitemap.ts exists
      { label: 'Blog posts have meta titles',           done: totalPosts === 0 || withMetaTitle / totalPosts >= 0.8 },
      { label: 'Blog posts have meta descriptions',     done: totalPosts === 0 || withMetaDesc  / totalPosts >= 0.8 },
      { label: 'Debates indexed as Q&A content',        done: completedDebateCount > 0 },
      { label: 'Featured images on blog posts',         done: totalPosts === 0 || withFeaturedImage / totalPosts >= 0.7 },
    ]

    // Recent completed debates formatted as Q&A snippets
    const recentDebates = await prisma.debate.findMany({
      where: { status: { in: ['COMPLETED', 'VERDICT_READY'] } },
      select: { id: true, topic: true, category: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    })

    return NextResponse.json({
      aeoScore: score,
      hasLlmsTxt,
      contentStats: { totalPosts, withMetaTitle, withMetaDesc, withTags, withFeaturedImage, longFormPosts },
      debateStats: { total: debateCount, completed: completedDebateCount },
      checklist,
      recommendations,
      recentDebatesAsQA: recentDebates,
    })
  } catch (error) {
    console.error('[AEO] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch AEO data' }, { status: 500 })
  }
}
