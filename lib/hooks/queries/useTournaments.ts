'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface Tournament {
  id: string
  name: string
  description: string | null
  status: string
  maxParticipants: number
  currentRound: number
  totalRounds: number
  participantCount: number
  matchCount: number
  startDate: Date
  endDate: Date | null
  minElo: number | null
  creator: { id: string; username: string; avatarUrl: string | null }
  isParticipant: boolean
  isPrivate: boolean
  format: string
  createdAt: Date
  winner: { id: string; username: string; avatarUrl: string | null } | null
}

export interface TournamentParticipant {
  id: string
  userId: string
  seed: number
  status: string
  selectedPosition: string | null
  eliminationRound: number | null
  eliminationReason: string | null
  cumulativeScore: number | null
  wins: number
  losses: number
  user: {
    id: string
    username: string
    avatarUrl: string | null
    eloRating: number
  }
}

export interface TournamentMatch {
  id: string
  round: number
  matchNumber: number
  participant1Id: string | null
  participant2Id: string | null
  winnerId: string | null
  status: string
  participant1Score: number | null
  participant2Score: number | null
  participant1ScoreBreakdown: Record<string, number> | null
  participant2ScoreBreakdown: Record<string, number> | null
  debate: {
    id: string
    topic: string
    status: string
    winnerId: string | null
    challenger: { id: string; username: string }
    opponent: { id: string; username: string } | null
  } | null
}

export interface TournamentDetail {
  id: string
  name: string
  description: string | null
  status: string
  maxParticipants: number
  currentRound: number
  totalRounds: number
  startDate: string
  endDate: string | null
  minElo: number | null
  roundDuration: number
  reseedAfterRound: boolean
  reseedMethod: string
  format: 'BRACKET' | 'CHAMPIONSHIP' | 'KING_OF_THE_HILL'
  assignedJudges: string[] | null
  creator: {
    id: string
    username: string
    avatarUrl: string | null
    eloRating: number
  }
  judge: {
    id: string
    name: string
    emoji: string
    personality: string
  } | null
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
  isParticipant: boolean
  isCreator: boolean
  isPrivate: boolean
  createdAt: string
}

interface TournamentsResponse {
  tournaments: Tournament[]
}

export function useTournaments(status?: string) {
  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.set('status', status)

  return useQuery<Tournament[]>({
    queryKey: ['tournaments', status],
    queryFn: async () => {
      const data = await fetchClient<TournamentsResponse | Tournament[]>(
        `/api/tournaments?${params}`
      )
      // Normalize: API sometimes returns array directly, sometimes wrapped
      if (Array.isArray(data)) return data
      return data.tournaments
    },
    staleTime: 30_000,
  })
}

export function useTournament(id: string | undefined) {
  return useQuery<TournamentDetail>({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const data = await fetchClient<{ tournament: TournamentDetail }>(`/api/tournaments/${id}`)
      return data.tournament
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'ACTIVE' || data?.status === 'IN_PROGRESS') return 30_000
      return false
    },
    staleTime: 15_000,
  })
}
