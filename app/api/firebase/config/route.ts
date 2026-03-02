import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/firebase/config - Get VAPID public key for Web Push API
export async function GET() {
  try {
    // Get VAPID public key from admin settings
    const vapidPublicKeySetting = await prisma.adminSetting.findUnique({
      where: { key: 'VAPID_PUBLIC_KEY' },
    })

    const vapidPublicKey = vapidPublicKeySetting?.value || process.env.VAPID_PUBLIC_KEY

    if (!vapidPublicKey) {
      return NextResponse.json(
        { 
          error: 'VAPID keys not configured',
          vapidKey: null,
        },
        { status: 200 } // Return 200 so frontend can check vapidKey
      )
    }

    return NextResponse.json({
      vapidKey: vapidPublicKey, // Return VAPID public key for Web Push API
    })
  } catch (error) {
    console.error('Failed to get VAPID config:', error)
    return NextResponse.json(
      { error: 'Failed to get VAPID config', vapidKey: null },
      { status: 500 }
    )
  }
}

