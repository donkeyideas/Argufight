'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface ELOLeaderboardEntry {
  rank: number
  id: string
  username: string
  avatarUrl: string | null
  eloRating: number
  debatesWon: number
  debatesLost: number
  debatesTied: number
  totalDebates: number
  winRate: number
  overallScore: string
  overallScorePercent: number
}

export interface TournamentLeaderboardEntry {
  rank: number
  id: string
  username: string
  avatarUrl: string | null
  tournamentsWon: number
  totalTournamentWins: number
  totalTournamentLosses: number
  totalTournamentMatches: number
  tournamentWinRate: number
  averageTournamentScore: number
  tournamentScore: number
}

export type LeaderboardEntry = ELOLeaderboardEntry | TournamentLeaderboardEntry

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  userRank: LeaderboardEntry | null
}

export function useLeaderboard(type: 'elo' | 'tournaments', page: number = 1, userId?: string) {
  const endpoint = type === 'elo' ? '/api/leaderboard' : '/api/leaderboard/tournaments'
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', '25')
  if (userId) params.set('userId', userId)

  return useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', type, page, userId],
    queryFn: () => fetchClient<LeaderboardResponse>(`${endpoint}?${params}`),
    placeholderData: keepPreviousData,
    staleTime: 120_000,
  })
}
