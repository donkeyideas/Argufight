'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface UserProfile {
  id: string
  email?: string
  username: string
  avatarUrl: string | null
  bio: string | null
  eloRating: number
  coins?: number
  debatesWon: number
  debatesLost: number
  debatesTied: number
  totalDebates: number
  totalScore: number
  totalMaxScore: number
  totalWordCount?: number
  totalStatements?: number
  averageWordCount?: number
  averageRounds?: number
  winRate?: number
  createdAt: Date | string
  subscriptionTier?: string
  subscription?: {
    tier: 'FREE' | 'PRO'
  }
}

export interface TournamentStats {
  totalTournaments: number
  completedTournaments: number
  activeTournaments: number
  championships: number
  totalTournamentWins: number
  totalTournamentLosses: number
  winRate: number
  bestFinish: number
}

interface ProfileResponse {
  user: UserProfile
}

/** Fetch own profile (no id) or another user's profile (with id) */
export function useProfile(userId?: string) {
  const isOwnProfile = !userId

  return useQuery<UserProfile>({
    queryKey: isOwnProfile ? ['profile', 'me'] : ['profile', userId],
    queryFn: async () => {
      if (isOwnProfile) {
        const data = await fetchClient<ProfileResponse>('/api/profile')
        return data.user
      }
      const data = await fetchClient<ProfileResponse>(`/api/users/${userId}/profile`)
      return data.user
    },
    staleTime: 60_000,
  })
}

export function useTournamentStats() {
  return useQuery<TournamentStats>({
    queryKey: ['profile', 'tournamentStats'],
    queryFn: async () => {
      const data = await fetchClient<{ stats: TournamentStats }>('/api/profile/tournament-stats')
      return data.stats
    },
    staleTime: 120_000,
  })
}
