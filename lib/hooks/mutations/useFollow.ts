'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'
import type { FollowStatus } from '@/lib/hooks/queries/useFollow'

interface ToggleFollowResponse {
  success: boolean
  following: boolean
  message: string
}

export function useToggleFollow(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchClient<ToggleFollowResponse>(`/api/users/${userId}/follow`, { method: 'POST' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['follow', userId] })
      const previous = queryClient.getQueryData<FollowStatus>(['follow', userId])

      if (previous) {
        queryClient.setQueryData<FollowStatus>(['follow', userId], {
          ...previous,
          isFollowing: !previous.isFollowing,
          followerCount: previous.isFollowing
            ? Math.max(0, previous.followerCount - 1)
            : previous.followerCount + 1,
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['follow', userId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follow', userId] })
    },
  })
}
