import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/debates/[id] - Get single debate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Trigger AI response in background when debate is viewed
    after(async () => {
      try {
        const { triggerAIResponseForDebate } = await import('@/lib/ai/trigger-ai-response')
        await triggerAIResponseForDebate(id)
      } catch {
        // AI trigger failure is non-critical
      }
    })

    // Inline round advancement: if deadline expired, advance now instead of waiting for cron
    try {
      const { checkDebateRound } = await import('@/lib/debates/round-advancement')
      await checkDebateRound(id)
    } catch {
      // Round advancement failure is non-critical — continue serving data
    }

    const { searchParams } = new URL(request.url)
    const shareToken = searchParams.get('shareToken') // For accessing private debates
    
    // Get current user session for access control
    const session = await verifySession()
    const currentUserId = session ? getUserIdFromSession(session) : null
    
    // Check if current user is admin
    let isAdmin = false
    if (currentUserId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { isAdmin: true, email: true, username: true },
        })
        isAdmin = user?.isAdmin || false
        console.log('[API /debates/[id]] Admin check:', {
          currentUserId,
          isAdmin,
          userEmail: user?.email || 'not found',
          username: user?.username || 'not found',
          userFound: !!user,
        })
      } catch (adminCheckError) {
        console.error('[API /debates/[id]] Error checking admin status:', adminCheckError)
        isAdmin = false
      }
    } else {
      console.log('[API /debates/[id]] No currentUserId, cannot check admin status')
    }
    
    // Try to fetch debate with participants, but handle errors gracefully
    let debate
    try {
      debate = await prisma.debate.findUnique({
        where: { id },
        select: {
          id: true,
          topic: true,
          description: true,
          category: true,
          status: true,
          challengerId: true,
          opponentId: true,
          challengerPosition: true,
          opponentPosition: true,
          totalRounds: true,
          currentRound: true,
          roundDeadline: true,
          speedMode: true,
          allowCopyPaste: true,
          isPrivate: true,
          shareToken: true,
          winnerId: true,
          verdictReached: true,
          verdictDate: true,
          appealedAt: true,
          appealStatus: true,
          appealCount: true,
          appealedBy: true,
          originalWinnerId: true,
          appealReason: true,
          appealedStatements: true,
          appealRejectionReason: true,
          spectatorCount: true,
          challengeType: true,
          isOnboardingDebate: true,
          createdAt: true,
          // viewCount fetched separately below (Prisma client may not have it)
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
          opponent: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
          statements: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                }
              }
            },
            orderBy: {
              round: 'asc',
            }
          },
          images: {
            select: {
              id: true,
              url: true,
              alt: true,
              caption: true,
              order: true,
            },
            orderBy: {
              order: 'asc',
            }
          },
          verdicts: {
            include: {
              judge: {
                select: {
                  id: true,
                  name: true,
                  emoji: true,
                  personality: true,
                }
              }
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 3, // EXACTLY 3 judges (SAME as regular debates)
          },
          tournamentMatch: {
            select: {
              id: true,
              status: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                  currentRound: true,
                  totalRounds: true,
                  format: true, // Include tournament format for King of the Hill detection
                  participants: {
                    select: {
                      id: true,
                      userId: true,
                      cumulativeScore: true,
                      eliminationRound: true,
                      eliminationReason: true,
                      status: true,
                      user: {
                        select: {
                          id: true,
                          username: true,
                          avatarUrl: true,
                          eloRating: true,
                        },
                      },
                    },
                  },
                },
              },
              round: {
                select: {
                  roundNumber: true,
                },
              },
            },
          },
          participants: {
            select: {
              id: true,
              userId: true, // Explicitly include userId
              position: true,
              status: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  eloRating: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
          hasBeltAtStake: true,
          beltStakeType: true,
          stakedBelt: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
              designImageUrl: true,
              currentHolderId: true,
              currentHolder: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      })
    } catch (queryError: any) {
      // If participants relation fails, try without it
      console.error('Error fetching debate with participants, retrying without:', queryError)
      debate = await prisma.debate.findUnique({
        where: { id },
        select: {
          id: true,
          topic: true,
          description: true,
          category: true,
          status: true,
          challengerId: true,
          opponentId: true,
          challengerPosition: true,
          opponentPosition: true,
          totalRounds: true,
          currentRound: true,
          roundDeadline: true,
          speedMode: true,
          allowCopyPaste: true,
          isPrivate: true,
          shareToken: true,
          winnerId: true,
          verdictReached: true,
          verdictDate: true,
          appealedAt: true,
          appealStatus: true,
          appealCount: true,
          appealedBy: true,
          originalWinnerId: true,
          appealReason: true,
          appealedStatements: true,
          appealRejectionReason: true,
          spectatorCount: true,
          challengeType: true,
          createdAt: true,
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
          opponent: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
          participants: {
            select: {
              id: true,
              userId: true, // Explicitly include userId
              position: true,
              status: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  eloRating: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
          statements: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                }
              }
            },
            orderBy: {
              round: 'asc',
            }
          },
          images: {
            select: {
              id: true,
              url: true,
              alt: true,
              caption: true,
              order: true,
            },
            orderBy: {
              order: 'asc',
            }
          },
          verdicts: {
            include: {
              judge: {
                select: {
                  id: true,
                  name: true,
                  emoji: true,
                  personality: true,
                }
              }
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 3, // EXACTLY 3 judges (SAME as regular debates)
          },
          tournamentMatch: {
            select: {
              id: true,
              status: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                  currentRound: true,
                  totalRounds: true,
                  format: true, // Include tournament format for King of the Hill detection
                  participants: {
                    select: {
                      id: true,
                      userId: true,
                      cumulativeScore: true,
                      eliminationRound: true,
                      eliminationReason: true,
                      status: true,
                      user: {
                        select: {
                          id: true,
                          username: true,
                          avatarUrl: true,
                          eloRating: true,
                        },
                      },
                    },
                  },
                },
              },
              round: {
                select: {
                  roundNumber: true,
                },
              },
            },
          },
          hasBeltAtStake: true,
          beltStakeType: true,
          stakedBelt: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
              designImageUrl: true,
              currentHolderId: true,
              currentHolder: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      })
      // Set participants to empty array if query failed
      if (debate) {
        (debate as any).participants = []
      }
    }

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      )
    }


    // Check access for private debates
    // Admins can always access private debates
    console.log('[API /debates/[id]] Privacy check:', {
      debateId: id,
      isPrivate: debate.isPrivate,
      isAdmin,
      currentUserId,
      willCheckAccess: debate.isPrivate && !isAdmin,
    })
    
    if (debate.isPrivate && !isAdmin) {
      const participants = (debate as any).participants || []
      const isParticipant = currentUserId && (
        debate.challengerId === currentUserId || 
        debate.opponentId === currentUserId ||
        participants.some((p: any) => p.userId === currentUserId)
      )
      const hasValidToken = shareToken && debate.shareToken === shareToken
      
      console.log('[API /debates/[id]] Private debate access check:', {
        debateId: id,
        isPrivate: debate.isPrivate,
        isAdmin,
        currentUserId,
        isParticipant,
        hasValidToken,
        challengerId: debate.challengerId,
        opponentId: debate.opponentId,
      })
      
      if (!isParticipant && !hasValidToken) {
        console.log('[API /debates/[id]] Access denied for private debate - not admin, not participant, no token')
        return NextResponse.json(
          { error: 'This debate is private. A share token is required to access it.' },
          { status: 403 }
        )
      }
    } else if (debate.isPrivate && isAdmin) {
      console.log('[API /debates/[id]] ✅ Admin accessing private debate:', id)
    } else if (!debate.isPrivate) {
      console.log('[API /debates/[id]] Public debate, access allowed')
    }

    // Fetch viewCount separately (Prisma client may not have this field yet)
    let viewCount = 0
    try {
      const result = await prisma.$queryRaw<Array<{ view_count: number }>>`
        SELECT view_count FROM debates WHERE id = ${id}
      `
      viewCount = result[0]?.view_count || 0
    } catch (error) {
      // If query fails, default to 0
      viewCount = 0
    }

    // Fetch the user who appealed if there's an appeal
    let appealedByUser = null
    if (debate.appealedBy) {
      try {
        const appealedByUserData = await prisma.user.findUnique({
          where: { id: debate.appealedBy },
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        })
        appealedByUser = appealedByUserData
      } catch (error) {
        console.error('Failed to fetch appealedBy user:', error)
      }
    }

    // Fetch rematch fields using raw SQL if Prisma doesn't have them yet
    let rematchData = {
      rematchRequestedBy: null as string | null,
      rematchRequestedAt: null as Date | string | null,
      rematchStatus: null as string | null,
      originalDebateId: null as string | null,
      rematchDebateId: null as string | null,
    }

    try {
      const rematchResult = await prisma.$queryRawUnsafe<Array<{
        rematch_requested_by: string | null
        rematch_requested_at: Date | null
        rematch_status: string | null
        original_debate_id: string | null
        rematch_debate_id: string | null
      }>>(`
        SELECT 
          rematch_requested_by,
          rematch_requested_at,
          rematch_status,
          original_debate_id,
          rematch_debate_id
        FROM debates
        WHERE id = $1
      `, id)

      if (rematchResult.length > 0) {
        rematchData = {
          rematchRequestedBy: rematchResult[0].rematch_requested_by,
          rematchRequestedAt: rematchResult[0].rematch_requested_at,
          rematchStatus: rematchResult[0].rematch_status,
          originalDebateId: rematchResult[0].original_debate_id,
          rematchDebateId: rematchResult[0].rematch_debate_id,
        }
      }
    } catch (error) {
      console.error('Failed to fetch rematch data:', error)
      // Continue without rematch data if query fails
    }

    // Debug: Log belt information before returning
    const beltData = {
      hasBeltAtStake: (debate as any).hasBeltAtStake,
      beltStakeType: (debate as any).beltStakeType,
      stakedBelt: (debate as any).stakedBelt,
      winnerId: (debate as any).winnerId,
    }
    console.log('[API /debates/[id]] Belt data in response:', JSON.stringify(beltData, null, 2))
    
    // If hasBeltAtStake is true but stakedBelt is null, try to fetch it directly
    if ((debate as any).hasBeltAtStake && !(debate as any).stakedBelt) {
      console.log('[API /debates/[id]] hasBeltAtStake is true but stakedBelt is null, attempting to fetch...')
      try {
        // First try: Find belt by stakedInDebateId (if still staked)
        let stakedBelt = await prisma.belt.findFirst({
          where: {
            stakedInDebateId: id,
          },
          select: {
            id: true,
            name: true,
            type: true,
            category: true,
            designImageUrl: true,
            currentHolderId: true,
            currentHolder: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        })
        
        // Second try: Find belt through belt challenge relation
        if (!stakedBelt) {
          console.log('[API /debates/[id]] Belt not found via stakedInDebateId, trying belt challenge...')
          const beltChallenge = await prisma.beltChallenge.findFirst({
            where: {
              debateId: id,
            },
            select: {
              beltId: true,
            },
          })
          
          if (beltChallenge) {
            console.log('[API /debates/[id]] Found belt challenge with beltId:', beltChallenge.beltId)
            stakedBelt = await prisma.belt.findUnique({
              where: {
                id: beltChallenge.beltId,
              },
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                designImageUrl: true,
                currentHolderId: true,
                currentHolder: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            })
          }
        }
        
        // Third try: Find belt through belt history (most recent transfer for this debate)
        if (!stakedBelt) {
          console.log('[API /debates/[id]] Belt not found via challenge, trying belt history...')
          const beltHistory = await prisma.beltHistory.findFirst({
            where: {
              debateId: id,
            },
            orderBy: {
              transferredAt: 'desc',
            },
            select: {
              beltId: true,
            },
          })
          
          if (beltHistory) {
            console.log('[API /debates/[id]] Found belt history with beltId:', beltHistory.beltId)
            stakedBelt = await prisma.belt.findUnique({
              where: {
                id: beltHistory.beltId,
              },
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                designImageUrl: true,
                currentHolderId: true,
                currentHolder: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            })
          }
        }
        
        if (stakedBelt) {
          console.log('[API /debates/[id]] Found staked belt via fallback query:', stakedBelt)
          ;(debate as any).stakedBelt = stakedBelt
        } else {
          console.log('[API /debates/[id]] Could not find staked belt via any method')
        }
      } catch (error) {
        console.error('[API /debates/[id]] Error fetching staked belt:', error)
      }
    }

    // Check if debate has no statements (for frontend to show appropriate message)
    const hasNoStatements = !debate.statements || debate.statements.length === 0
    
    return NextResponse.json({
      ...debate,
      viewCount,
      images: debate.images || [],
      participants: (debate as any).participants || [],
      appealedByUser,
      ...rematchData,
      // Explicitly include belt data to ensure it's in the response
      hasBeltAtStake: (debate as any).hasBeltAtStake,
      beltStakeType: (debate as any).beltStakeType,
      stakedBelt: (debate as any).stakedBelt,
      // Helper flag for frontend to know if debate has no statements
      hasNoStatements,
    })
  } catch (error: any) {
    console.error('Failed to fetch debate:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch debate',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

