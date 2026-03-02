import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getGeoAnalysis } from '@/lib/seo/geo-analysis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const analysis = await getGeoAnalysis()
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error fetching GEO analysis:', error)
    return NextResponse.json({ error: 'Failed to fetch GEO analysis' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { llmsTxtContent } = body

    if (typeof llmsTxtContent !== 'string') {
      return NextResponse.json({ error: 'Invalid llms.txt content' }, { status: 400 })
    }

    await prisma.adminSetting.upsert({
      where: { key: 'seo_geo_llms_txt_content' },
      update: {
        value: llmsTxtContent,
        updatedBy: userId,
      },
      create: {
        key: 'seo_geo_llms_txt_content',
        value: llmsTxtContent,
        category: 'seo',
        description: 'Content for llms.txt file (GEO)',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating llms.txt:', error)
    return NextResponse.json({ error: 'Failed to update llms.txt' }, { status: 500 })
  }
}
