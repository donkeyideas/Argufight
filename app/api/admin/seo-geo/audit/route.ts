import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { runFullAudit } from '@/lib/seo/audit-engine'
import { generateRecommendations } from '@/lib/seo/recommendations-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const latestAudit = await prisma.seoAudit.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ audit: latestAudit })
  } catch (error) {
    console.error('Error fetching audit:', error)
    return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run the full audit
    const auditResult = await runFullAudit()

    // Save audit to database
    const savedAudit = await prisma.seoAudit.create({
      data: {
        overallScore: auditResult.overallScore,
        technicalScore: auditResult.technicalScore,
        contentScore: auditResult.contentScore,
        performanceScore: auditResult.performanceScore,
        geoScore: auditResult.geoScore,
        totalIssues: auditResult.totalIssues,
        criticalIssues: auditResult.criticalIssues,
        warningIssues: auditResult.warningIssues,
        infoIssues: auditResult.infoIssues,
        results: JSON.parse(JSON.stringify(auditResult)),
        runBy: userId,
      },
    })

    // Generate and save recommendations
    const recommendations = generateRecommendations(auditResult)

    // Clear old pending recommendations from previous audits and insert new ones
    await prisma.seoRecommendation.deleteMany({
      where: { status: 'pending' },
    })

    if (recommendations.length > 0) {
      await prisma.seoRecommendation.createMany({
        data: recommendations.map((r) => ({
          category: r.category,
          severity: r.severity,
          title: r.title,
          description: r.description,
          impact: r.impact,
          effort: r.effort,
          pageUrl: r.pageUrl || null,
          auditId: savedAudit.id,
        })),
      })
    }

    return NextResponse.json({
      audit: savedAudit,
      recommendationsCount: recommendations.length,
    })
  } catch (error) {
    console.error('Error running audit:', error)
    return NextResponse.json({ error: 'Failed to run audit' }, { status: 500 })
  }
}
