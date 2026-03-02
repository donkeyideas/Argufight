'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export function useSaveDebate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (debateId: string) =>
      fetchClient(`/api/debates/${debateId}/save`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debates', 'saved'] })
    },
  })
}

export function useUnsaveDebate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (debateId: string) =>
      fetchClient(`/api/debates/${debateId}/save`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debates', 'saved'] })
    },
  })
}
