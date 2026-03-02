import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

interface TickerUpdate {
  id: string
  type: 'BIG_BATTLE' | 'HIGH_VIEWS' | 'MAJOR_UPSET' | 'NEW_VERDICT' | 'STREAK' | 'MILESTONE' | 'SPONSORED' | 'ADVERTISER'
  title: string
  message: string
  debateId: string | null
  priority: 'high' | 'medium' | 'low'
  createdAt: string
  destinationUrl?: string
  adId?: string
  imageUrl?: string
}

export async function GET(request: NextRequest) {
  try {
    const updates: TickerUpdate[] = []
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Check if user is logged in and if they're an advertiser
    let isAdvertiser = false
    let advertiserId: string | null = null
    let userId: string | null = null
    let userEmail: string | null = null
    let session: any = null
    
    let isAdmin = false
    try {
      session = await verifySession()
      if (session) {
        userId = getUserIdFromSession(session)
        if (userId) {
          // Single query for both email and isAdmin
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, isAdmin: true },
          })

          if (user) {
            userEmail = user.email
            isAdmin = user.isAdmin || false
            const advertiser = await prisma.advertiser.findUnique({
              where: { contactEmail: user.email },
              select: { id: true, status: true },
            })

            if (advertiser && advertiser.status === 'APPROVED') {
              isAdvertiser = true
              advertiserId = advertiser.id
            }
          }
        }
      }
    } catch (error) {
      // Not logged in or session error - continue as regular user
    }

    // If user is an admin, show admin-specific notifications
    if (isAdmin && userId) {
      console.log('[Ticker API] User is admin, showing admin-specific updates')
      
      // Get admin-specific notifications
      // 1. New support tickets (OPEN status, created in last 24 hours)
      try {
        const newTickets = await prisma.supportTicket.findMany({
          where: {
            status: 'OPEN',
            createdAt: { gte: oneDayAgo },
          },
          include: {
            user: {
              select: {
                username: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

        for (const ticket of newTickets) {
          updates.push({
            id: `support-ticket-${ticket.id}`,
            type: 'ADVERTISER', // Using ADVERTISER type for admin notifications
            title: 'New Support Ticket',
            message: `${ticket.user.username} submitted: "${ticket.subject}"`,
            debateId: null,
            priority: ticket.priority === 'URGENT' ? 'high' : ticket.priority === 'HIGH' ? 'high' : 'medium',
            createdAt: ticket.createdAt.toISOString(),
          })
        }
      } catch (ticketError) {
        console.error('[Ticker API] Error fetching new support tickets:', ticketError)
      }

      // 2. New replies from users (non-admin replies to tickets)
      try {
        const newReplies = await prisma.supportTicketReply.findMany({
          where: {
            author: {
              isAdmin: false, // Only non-admin replies
            },
            createdAt: { gte: oneDayAgo },
            isInternal: false, // Not internal notes
          },
          include: {
            ticket: {
              select: {
                id: true,
                subject: true,
                user: {
                  select: {
                    username: true,
                  },
                },
              },
            },
            author: {
              select: {
                username: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

        for (const reply of newReplies) {
          updates.push({
            id: `support-reply-${reply.id}`,
            type: 'ADVERTISER',
            title: 'New Ticket Reply',
            message: `${reply.author.username} replied to "${reply.ticket.subject}"`,
            debateId: null,
            priority: 'medium',
            createdAt: reply.createdAt.toISOString(),
          })
        }
      } catch (replyError) {
        console.error('[Ticker API] Error fetching new support ticket replies:', replyError)
      }

      // 3. Only show IN_FEED ads for admins (same as advertiser)
      const allInFeedAds = await prisma.advertisement.findMany({
        where: {
          status: 'ACTIVE',
          type: 'IN_FEED',
          OR: [
            { startDate: null, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      const inFeedAds = allInFeedAds.filter(ad => ad.creativeUrl && ad.creativeUrl.trim() !== '')
      
      for (const ad of inFeedAds.slice(0, 2)) {
        updates.push({
          id: `sponsored-${ad.id}`,
          type: 'SPONSORED',
          title: 'SPONSORED',
          message: ad.title || 'Advertisement',
          debateId: null,
          priority: 'medium',
          createdAt: ad.createdAt.toISOString(),
          destinationUrl: ad.targetUrl || undefined,
          adId: ad.id,
          imageUrl: ad.creativeUrl!,
        })
      }

      // Sort by priority and recency
      updates.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      console.log('[Ticker API] Admin - Returning', updates.length, 'updates:', updates.map(u => ({ type: u.type, title: u.title, message: u.message })))

      return NextResponse.json(
        { updates: updates.slice(0, 10) },
        {
          headers: {
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          },
        }
      )
    }

    // If user is an advertiser, show advertiser-specific notifications only
    if (isAdvertiser && advertiserId) {
      console.log('[Ticker API] User is advertiser, showing advertiser-specific updates')
      
      // Get advertiser-specific notifications
      // 1. Campaign status updates (approved, rejected, active)
      try {
        // Use select to avoid querying payment_status if it doesn't exist
        const recentCampaigns = await prisma.campaign.findMany({
          where: {
            advertiserId: advertiserId,
            OR: [
              { status: 'APPROVED', createdAt: { gte: oneDayAgo } },
              { status: 'REJECTED', createdAt: { gte: oneDayAgo } },
              { status: 'ACTIVE', createdAt: { gte: oneDayAgo } },
            ],
          },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

        for (const campaign of recentCampaigns) {
          const campaignDate = campaign.updatedAt || campaign.createdAt
          if (campaign.status === 'APPROVED' && campaignDate > oneHourAgo) {
          updates.push({
            id: `campaign-approved-${campaign.id}`,
            type: 'ADVERTISER',
            title: 'Campaign Approved',
            message: `Your campaign "${campaign.name}" has been approved and is now active!`,
            debateId: null,
            priority: 'high',
            createdAt: campaignDate.toISOString(),
          })
          } else if (campaign.status === 'REJECTED' && campaignDate > oneHourAgo) {
            updates.push({
              id: `campaign-rejected-${campaign.id}`,
              type: 'ADVERTISER',
              title: 'Campaign Update',
              message: `Your campaign "${campaign.name}" requires review. Check your dashboard for details.`,
              debateId: null,
              priority: 'medium',
              createdAt: campaignDate.toISOString(),
            })
          } else if (campaign.status === 'ACTIVE' && campaignDate > oneHourAgo) {
            updates.push({
              id: `campaign-active-${campaign.id}`,
              type: 'ADVERTISER',
              title: 'Campaign Active',
              message: `Your campaign "${campaign.name}" is currently running.`,
              debateId: null,
              priority: 'low',
              createdAt: campaignDate.toISOString(),
            })
          }
        }
      } catch (campaignError) {
        console.error('[Ticker API] Error fetching campaigns:', campaignError)
      }

      // 2. Support ticket reply notifications
      try {
        // Skip if no user email is available
        if (!userEmail) {
          console.log('[Ticker API] No user email available for support ticket check')
          return NextResponse.json({ updates: [] })
        }

        // Get the user ID for this advertiser
        const advertiserUser = await prisma.user.findUnique({
          where: { email: userEmail },
          select: { id: true },
        })

        if (advertiserUser) {
          // Get recent support ticket replies from admins
          const recentTicketReplies = await prisma.supportTicketReply.findMany({
            where: {
              ticket: {
                userId: advertiserUser.id, // Get tickets for this advertiser's user
              },
              author: {
                isAdmin: true, // Only admin replies
              },
              isInternal: false, // Not internal notes
              createdAt: { gte: oneDayAgo },
            },
            include: {
              ticket: {
                select: {
                  id: true,
                  subject: true,
                },
              },
              author: {
                select: {
                  username: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })

          for (const reply of recentTicketReplies) {
            updates.push({
              id: `support-reply-${reply.id}`,
              type: 'ADVERTISER',
              title: 'Support Ticket Reply',
              message: `${reply.author.username} replied to your support ticket: "${reply.ticket.subject}"`,
              debateId: null,
              priority: 'high',
              createdAt: reply.createdAt.toISOString(),
            })
          }
        }
      } catch (ticketError) {
        console.error('[Ticker API] Error fetching support ticket replies:', ticketError)
      }

      // 3. Offer status updates (creator accepted, replied, declined)
      const recentOffers = await prisma.offer.findMany({
        where: {
          advertiserId: advertiserId,
          OR: [
            { respondedAt: { gte: oneDayAgo } },
            { createdAt: { gte: oneDayAgo } },
          ],
          status: { in: ['ACCEPTED', 'DECLINED'] },
        },
        include: {
          creator: {
            select: { username: true },
          },
          campaign: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      for (const offer of recentOffers) {
        const offerDate = offer.respondedAt || offer.createdAt
        if (offer.status === 'ACCEPTED' && offerDate > oneHourAgo) {
          updates.push({
            id: `offer-accepted-${offer.id}`,
            type: 'ADVERTISER',
            title: 'Offer Accepted',
            message: `${offer.creator.username} accepted your offer for "${offer.campaign.name}"`,
            debateId: null,
            priority: 'high',
            createdAt: offerDate.toISOString(),
          })
        } else if (offer.status === 'DECLINED' && offerDate > oneHourAgo) {
          updates.push({
            id: `offer-declined-${offer.id}`,
            type: 'ADVERTISER',
            title: 'Offer Update',
            message: `${offer.creator.username} declined your offer for "${offer.campaign.name}"`,
            debateId: null,
            priority: 'low',
            createdAt: offerDate.toISOString(),
          })
        }
      }

      // 3. Only show IN_FEED ads (not BANNER) for advertisers
      const allInFeedAds = await prisma.advertisement.findMany({
        where: {
          status: 'ACTIVE',
          type: 'IN_FEED', // Only IN_FEED, not BANNER
          OR: [
            { startDate: null, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      // Filter for ads with images (creativeUrl)
      const inFeedAds = allInFeedAds.filter(ad => ad.creativeUrl && ad.creativeUrl.trim() !== '')
      
      console.log('[Ticker API] Advertiser - Found', allInFeedAds.length, 'IN_FEED ads,', inFeedAds.length, 'with images')

      for (const ad of inFeedAds.slice(0, 2)) { // Limit to 2 for advertisers
        updates.push({
          id: `sponsored-${ad.id}`,
          type: 'SPONSORED',
          title: 'SPONSORED',
          message: ad.title || 'Advertisement',
          debateId: null,
          priority: 'medium',
          createdAt: ad.createdAt.toISOString(),
          destinationUrl: ad.targetUrl || undefined,
          adId: ad.id,
          imageUrl: ad.creativeUrl!,
        })
        console.log('[Ticker API] Advertiser - Added IN_FEED ad:', ad.title)
      }
      
      console.log('[Ticker API] Advertiser - Total updates:', updates.length)

      // Sort by priority and recency
      updates.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      return NextResponse.json(
        { updates: updates.slice(0, 10) },
        {
          headers: {
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          },
        }
      )
    }

    // Regular user flow - show debate updates and sponsored ads

    // 1. BIG BATTLES - High ELO matchups (both players ELO > 1500 or combined > 3000)
    const bigBattles = await prisma.debate.findMany({
      where: {
        status: 'ACTIVE',
        createdAt: {
          gte: oneDayAgo,
        },
        challenger: {
          eloRating: { gte: 1500 },
        },
        opponent: {
          eloRating: { gte: 1500 },
        },
      },
      select: {
        id: true,
        topic: true,
        createdAt: true,
        challenger: {
          select: {
            username: true,
            eloRating: true,
          },
        },
        opponent: {
          select: {
            username: true,
            eloRating: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    })

    for (const debate of bigBattles) {
      if (!debate.challenger || !debate.opponent) continue
      const combinedElo = debate.challenger.eloRating + debate.opponent.eloRating
      updates.push({
        id: `big-battle-${debate.id}`,
        type: 'BIG_BATTLE',
        title: 'BIG BATTLE',
        message: `${debate.challenger.username} (${debate.challenger.eloRating}) vs ${debate.opponent.username} (${debate.opponent.eloRating}) - ${debate.topic.substring(0, 50)}${debate.topic.length > 50 ? '...' : ''}`,
        debateId: debate.id,
        priority: combinedElo > 3500 ? 'high' : 'medium',
        createdAt: debate.createdAt.toISOString(),
      })
    }

    // 2. HIGH VIEWS - Debates with high view counts (viewCount > 50)
    const highViewDebates = await prisma.debate.findMany({
      where: {
        viewCount: { gte: 50 },
        createdAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        id: true,
        topic: true,
        viewCount: true,
        createdAt: true,
        challenger: {
          select: {
            username: true,
          },
        },
        opponent: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        viewCount: 'desc',
      },
      take: 5,
    })

    for (const debate of highViewDebates) {
      if (!debate.challenger || !debate.opponent) continue
      updates.push({
        id: `high-views-${debate.id}`,
        type: 'HIGH_VIEWS',
        title: 'TRENDING',
        message: `${debate.challenger.username} vs ${debate.opponent.username} - ${debate.viewCount} views • ${debate.topic.substring(0, 40)}${debate.topic.length > 40 ? '...' : ''}`,
        debateId: debate.id,
        priority: debate.viewCount > 100 ? 'high' : 'medium',
        createdAt: debate.createdAt.toISOString(),
      })
    }

    // 3. MAJOR UPSETS - Low ELO beating high ELO (difference > 200 points)
    const recentCompleted = await prisma.debate.findMany({
      where: {
        status: 'COMPLETED',
        endedAt: {
          gte: oneDayAgo,
        },
        challengerEloChange: { not: null },
        opponentEloChange: { not: null },
      },
      select: {
        id: true,
        topic: true,
        createdAt: true,
        endedAt: true,
        challenger: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
        challengerEloChange: true,
        opponentEloChange: true,
        winnerId: true,
      },
      orderBy: {
        endedAt: 'desc',
      },
      take: 10,
    })

    for (const debate of recentCompleted) {
      if (!debate.challenger || !debate.opponent) continue
      if (!debate.winnerId) continue // Skip if no winner determined
      
      const winnerId = debate.winnerId
      const challengerElo = debate.challenger.eloRating - (debate.challengerEloChange || 0)
      const opponentElo = debate.opponent.eloRating - (debate.opponentEloChange || 0)
      const eloDiff = Math.abs(challengerElo - opponentElo)
      
      if (eloDiff > 200) {
        const winner = winnerId === debate.challenger.id ? debate.challenger : debate.opponent
        const loser = winnerId === debate.challenger.id ? debate.opponent : debate.challenger
        const winnerElo = winnerId === debate.challenger.id ? challengerElo : opponentElo
        const loserElo = winnerId === debate.challenger.id ? opponentElo : challengerElo
        
        if (winnerElo < loserElo) {
          // Upset: lower ELO won
          updates.push({
            id: `upset-${debate.id}`,
            type: 'MAJOR_UPSET',
            title: 'MAJOR UPSET',
            message: `${winner.username} (${Math.round(winnerElo)}) defeated ${loser.username} (${Math.round(loserElo)}) • ${debate.topic.substring(0, 40)}${debate.topic.length > 40 ? '...' : ''}`,
            debateId: debate.id,
            priority: eloDiff > 300 ? 'high' : 'medium',
            createdAt: debate.endedAt?.toISOString() || debate.createdAt.toISOString(),
          })
        }
      }
    }

    // 4. NEW VERDICTS - Recently completed debates with verdicts
    const newVerdicts = await prisma.debate.findMany({
      where: {
        status: 'COMPLETED',
        endedAt: {
          gte: oneHourAgo,
        },
        winnerId: { not: null },
      },
      select: {
        id: true,
        topic: true,
        createdAt: true,
        endedAt: true,
        winnerId: true,
        challenger: {
          select: {
            id: true,
            username: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        endedAt: 'desc',
      },
      take: 5,
    })

    for (const debate of newVerdicts) {
      if (!debate.challenger || !debate.opponent) continue
      if (!debate.winnerId) continue // Skip if no winner determined
      
      const winnerId = debate.winnerId
      const winner = winnerId === debate.challenger.id ? debate.challenger : debate.opponent
      
      updates.push({
        id: `verdict-${debate.id}`,
        type: 'NEW_VERDICT',
        title: 'VERDICT',
        message: `${winner.username} won "${debate.topic.substring(0, 45)}${debate.topic.length > 45 ? '...' : ''}"`,
        debateId: debate.id,
        priority: 'medium',
        createdAt: debate.endedAt?.toISOString() || debate.createdAt.toISOString(),
      })
    }

    // 5. STREAKS - Users on winning streaks (3+ wins in a row)
    // First, get top users who might be on streaks
    const potentialStreakUsers = await prisma.user.findMany({
      where: {
        isAdmin: false,
        isBanned: false,
        debatesWon: { gte: 3 },
        totalDebates: { gte: 3 },
      },
      select: {
        id: true,
        username: true,
        debatesWon: true,
        totalDebates: true,
        eloRating: true,
      },
      orderBy: {
        eloRating: 'desc',
      },
      take: 20,
    })

    // Get all recent completed debates for these users in one query
    const userIds = potentialStreakUsers.map(u => u.id)
    const allRecentDebates = await prisma.debate.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { challengerId: { in: userIds } },
          { opponentId: { in: userIds } },
        ],
        endedAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
        endedAt: true,
        winnerId: true,
      },
      orderBy: {
        endedAt: 'desc',
      },
    })

    // Group debates by user and calculate streaks
    const userDebates = new Map<string, typeof allRecentDebates>()
    for (const debate of allRecentDebates) {
      if (!debate.winnerId) continue
      
      const winnerId = debate.winnerId
      if (userIds.includes(winnerId)) {
        if (!userDebates.has(winnerId)) {
          userDebates.set(winnerId, [])
        }
        userDebates.get(winnerId)!.push(debate)
      }
    }

    // Check for streaks
    for (const user of potentialStreakUsers) {
      const userRecentDebates = userDebates.get(user.id) || []
      if (userRecentDebates.length < 3) continue

      // Sort by endedAt desc and check consecutive wins
      userRecentDebates.sort((a, b) => 
        (b.endedAt?.getTime() || 0) - (a.endedAt?.getTime() || 0)
      )

      let streakCount = 0
      for (const debate of userRecentDebates) {
        if (debate.winnerId === user.id) {
          streakCount++
        } else {
          break
        }
      }

      if (streakCount >= 3) {
        updates.push({
          id: `streak-${user.id}-${Date.now()}`,
          type: 'STREAK',
          title: 'HOT STREAK',
          message: `${user.username} is on a ${streakCount}-win streak! (ELO: ${user.eloRating})`,
          debateId: null,
          priority: streakCount >= 5 ? 'high' : 'medium',
          createdAt: new Date().toISOString(),
        })
      }
    }

    // 6. MILESTONES - Users reaching ELO milestones (1500, 1600, 1700, etc.)
    const milestoneUsers = await prisma.user.findMany({
      where: {
        isAdmin: false,
        isBanned: false,
        eloRating: {
          gte: 1500,
        },
        updatedAt: {
          gte: oneHourAgo,
        },
      },
      select: {
        id: true,
        username: true,
        eloRating: true,
        updatedAt: true,
      },
      orderBy: {
        eloRating: 'desc',
      },
      take: 5,
    })

    for (const user of milestoneUsers) {
      const elo = Math.floor(user.eloRating)
      // Check if it's a milestone (1500, 1600, 1700, etc.)
      if (elo % 100 === 0 && elo >= 1500) {
        updates.push({
          id: `milestone-${user.id}-${elo}`,
          type: 'MILESTONE',
          title: 'MILESTONE',
          message: `${user.username} reached ${elo} ELO!`,
          debateId: null,
          priority: elo >= 2000 ? 'high' : 'medium',
          createdAt: user.updatedAt.toISOString(),
        })
      }
    }

    // 7. SPONSORED ADS - IN_FEED ads from advertisements table (admin-created)
    const inFeedAds = await prisma.advertisement.findMany({
      where: {
        status: 'ACTIVE',
        type: 'IN_FEED', // Only IN_FEED, not BANNER
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Filter for ads with images (creativeUrl)
    const sponsoredAds = inFeedAds.filter(ad => ad.creativeUrl && ad.creativeUrl.trim() !== '')
    
    console.log('[Ticker API] Found', inFeedAds.length, 'IN_FEED ads,', sponsoredAds.length, 'with images')

    for (const sponsoredAd of sponsoredAds.slice(0, 3)) { // Limit to 3 for ticker
      updates.push({
        id: `sponsored-${sponsoredAd.id}`,
        type: 'SPONSORED',
        title: 'SPONSORED',
        message: sponsoredAd.title || 'Advertisement',
        debateId: null,
        priority: 'medium',
        createdAt: sponsoredAd.createdAt.toISOString(),
        destinationUrl: sponsoredAd.targetUrl || undefined,
        adId: sponsoredAd.id,
        imageUrl: sponsoredAd.creativeUrl!,
      })
      console.log('[Ticker API] Added IN_FEED ad to updates:', {
        id: sponsoredAd.id,
        title: sponsoredAd.title,
        imageUrl: sponsoredAd.creativeUrl?.substring(0, 50) + '...',
      })
    }

    // 7b. PLATFORM ADS CAMPAIGNS - Only IN_FEED type (same as Direct Ads)
    // Platform Ads should only show in ticker if they're IN_FEED type
    try {
      const platformAdsCampaigns = await prisma.campaign.findMany({
        where: {
          type: 'PLATFORM_ADS',
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
          bannerUrl: { not: null },
          adType: 'IN_FEED', // Only IN_FEED type Platform Ads show in ticker (matches Direct Ads)
        },
        select: {
          id: true,
          name: true,
          bannerUrl: true,
          destinationUrl: true,
          ctaText: true,
          createdAt: true,
          adType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3, // Limit to 3 for ticker
      })

      console.log('[Ticker API] Found', platformAdsCampaigns.length, 'ACTIVE Platform Ads campaigns (IN_FEED type)')

      for (const campaign of platformAdsCampaigns) {
        if (campaign.bannerUrl) {
          updates.push({
            id: `platform-ad-${campaign.id}`,
            type: 'SPONSORED',
            title: 'SPONSORED',
            message: campaign.name,
            debateId: null,
            priority: 'medium',
            createdAt: campaign.createdAt.toISOString(),
            destinationUrl: campaign.destinationUrl || undefined,
            adId: campaign.id,
            imageUrl: campaign.bannerUrl,
          })
          console.log('[Ticker API] Added Platform Ads campaign to updates:', {
            id: campaign.id,
            name: campaign.name,
            adType: campaign.adType,
            imageUrl: campaign.bannerUrl?.substring(0, 50) + '...',
          })
        }
      }
    } catch (error: any) {
      // If Platform Ads query fails (e.g., adType field doesn't exist yet), skip it
      console.error('[Ticker API] Failed to fetch Platform Ads campaigns:', error.message)
    }
    
    console.log('[Ticker API] Total updates after adding sponsored ads:', updates.length)

    // Sort by priority and recency
    updates.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Return top 20 updates
    return NextResponse.json(
      {
        updates: updates.slice(0, 20),
        total: updates.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Failed to fetch ticker updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticker updates', updates: [] },
      { status: 500 }
    )
  }
}

