'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface FollowStatus {
  isFollowing: boolean
  followerCount: number
  followingCount: number
}

export function useFollowStatus(userId: string | undefined, currentUserId: string | undefined) {
  return useQuery<FollowStatus>({
    queryKey: ['follow', userId],
    queryFn: () => fetchClient<FollowStatus>(`/api/users/${userId}/follow`),
    enabled: !!userId && !!currentUserId && userId !== currentUserId,
    staleTime: 60_000,
  })
}
