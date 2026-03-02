import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const audits = await prisma.seoAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        overallScore: true,
        technicalScore: true,
        contentScore: true,
        performanceScore: true,
        geoScore: true,
        totalIssues: true,
        criticalIssues: true,
        warningIssues: true,
        infoIssues: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ audits: audits.reverse() })
  } catch (error) {
    console.error('Error fetching audit history:', error)
    return NextResponse.json({ error: 'Failed to fetch audit history' }, { status: 500 })
  }
}
