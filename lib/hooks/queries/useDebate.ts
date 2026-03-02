'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface DebateParticipant {
  id: string
  userId: string
  position?: string
  status: string
  joinedAt?: Date
  user: { id: string; username: string; avatarUrl: string | null; eloRating: number }
}

export interface DebateStatement {
  id: string
  round: number
  authorId: string
  author?: { id: string; username: string; avatarUrl: string | null }
}

export interface DebateImage {
  id: string
  url: string
  alt: string | null
  caption: string | null
  order: number
}

export interface DebateUser {
  id: string
  username: string
  avatarUrl: string | null
  eloRating: number
}

export interface Debate {
  id: string
  topic: string
  description?: string | null
  category: string
  status: string
  challengerId: string
  opponentId: string | null
  challengerPosition: string
  opponentPosition: string
  totalRounds: number
  currentRound: number
  roundDeadline: Date | null
  speedMode?: boolean
  allowCopyPaste?: boolean
  isPrivate: boolean
  shareToken: string | null
  winnerId: string | null
  verdictReached: boolean
  verdictDate: Date | null
  spectatorCount: number
  challengeType: string
  isOnboardingDebate?: boolean
  createdAt: Date
  endedAt?: Date | null
  viewCount?: number
  appealedAt?: Date | null
  appealStatus?: string | null
  appealCount?: number
  appealedBy?: string | null
  originalWinnerId?: string | null
  appealReason?: string | null
  appealRejectionReason?: string | null
  rematchRequestedBy?: string | null
  rematchStatus?: string | null
  challenger: DebateUser
  opponent: DebateUser | null
  statements: DebateStatement[]
  images: DebateImage[]
  verdicts: Array<{ id: string; judge: { id: string; name: string; emoji: string; personality: string } }>
  participants: DebateParticipant[]
  tournamentMatch: {
    id: string
    status?: string
    tournament: {
      id: string
      name: string
      format: string
      currentRound: number
      totalRounds: number
      participants?: DebateParticipant[]
    }
    round: { roundNumber: number }
  } | null
  hasBeltAtStake?: boolean
  beltStakeType?: string | null
  stakedBelt?: {
    id: string
    name: string
    type: string
    category: string
    designImageUrl: string | null
    currentHolderId: string
    currentHolder: { id: string; username: string; avatarUrl: string | null }
  } | null
  hasNoStatements?: boolean
}

function getPollingInterval(status: string | undefined): number | false {
  switch (status) {
    case 'WAITING': return 15_000
    case 'ACTIVE': return 8_000
    case 'COMPLETED':
    case 'VERDICT_READY': return 3_000
    default: return false
  }
}

export function useDebate(id: string | undefined, shareToken?: string) {
  return useQuery<Debate>({
    queryKey: ['debate', id],
    queryFn: () => {
      const params = shareToken ? `?shareToken=${shareToken}` : ''
      return fetchClient<Debate>(`/api/debates/${id}${params}`)
    },
    enabled: !!id,
    refetchInterval: (query) => getPollingInterval(query.state.data?.status),
    staleTime: 5_000,
  })
}
