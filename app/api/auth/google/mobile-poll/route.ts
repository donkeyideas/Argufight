import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * Poll for mobile OAuth result.
 * After Google OAuth completes, the mobile-callback stores the JWT
 * with a poll ID. The mobile app polls this endpoint to retrieve it.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing poll id' }, { status: 400 })
  }

  const key = `mobile_auth_${id}`

  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key },
    })

    if (!setting) {
      return NextResponse.json({ pending: true }, { status: 202 })
    }

    // Delete after reading (one-time use)
    await prisma.adminSetting.delete({ where: { key } }).catch(() => {})

    const data = JSON.parse(setting.value)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Mobile Poll] Error:', error)
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 })
  }
}
