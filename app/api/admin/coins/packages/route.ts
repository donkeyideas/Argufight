import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'


/**
 * GET /api/admin/coins/packages
 * Get all coin packages (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get packages from AdminSetting or use defaults
    const packages = [
      {
        id: 'starter',
        name: 'Starter',
        priceUSD: 4.99,
        baseCoins: 499,
        bonusCoins: 1,
        totalCoins: 500,
        bonusPercent: 0.2,
        isPopular: false,
      },
      {
        id: 'small',
        name: 'Small',
        priceUSD: 9.99,
        baseCoins: 999,
        bonusCoins: 25,
        totalCoins: 1024,
        bonusPercent: 2.5,
        isPopular: false,
      },
      {
        id: 'medium',
        name: 'Medium',
        priceUSD: 19.99,
        baseCoins: 1999,
        bonusCoins: 100,
        totalCoins: 2099,
        bonusPercent: 5.0,
        isPopular: false,
      },
      {
        id: 'large',
        name: 'Large',
        priceUSD: 49.99,
        baseCoins: 4999,
        bonusCoins: 500,
        totalCoins: 5499,
        bonusPercent: 10.0,
        isPopular: true,
      },
      {
        id: 'xl',
        name: 'XL',
        priceUSD: 99.99,
        baseCoins: 9999,
        bonusCoins: 1500,
        totalCoins: 11499,
        bonusPercent: 15.0,
        isPopular: false,
      },
    ]

    // Try to get from AdminSetting
    try {
      const settings = await prisma.adminSetting.findMany({
        where: {
          key: {
            startsWith: 'COIN_PACKAGE_',
          },
        },
      })

      if (settings.length > 0) {
        const settingsMap = settings.reduce((acc, setting) => {
          acc[setting.key] = setting.value
          return acc
        }, {} as Record<string, string>)

        packages.forEach((pkg) => {
          const priceKey = `COIN_PACKAGE_${pkg.name.toUpperCase()}_PRICE`
          const bonusKey = `COIN_PACKAGE_${pkg.name.toUpperCase()}_BONUS`
          
          if (settingsMap[priceKey]) {
            pkg.priceUSD = parseFloat(settingsMap[priceKey])
            pkg.baseCoins = Math.floor(pkg.priceUSD * 100)
          }
          if (settingsMap[bonusKey]) {
            pkg.bonusCoins = parseInt(settingsMap[bonusKey])
            pkg.totalCoins = pkg.baseCoins + pkg.bonusCoins
            pkg.bonusPercent = (pkg.bonusCoins / pkg.baseCoins) * 100
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch package settings:', error)
    }

    return NextResponse.json({ packages })
  } catch (error: any) {
    console.error('[API] Error fetching coin packages:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch coin packages' },
      { status: 500 }
    )
  }
}
