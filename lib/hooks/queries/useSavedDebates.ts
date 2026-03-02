'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'
import type { Debate } from './useDebate'

interface SavedDebatesResponse {
  debates: (Debate & { savedAt: Date })[]
  total: number
  limit: number
  offset: number
}

export function useSavedDebates(page: number = 1, limit: number = 25) {
  const offset = (page - 1) * limit

  return useQuery<SavedDebatesResponse>({
    queryKey: ['debates', 'saved', page, limit],
    queryFn: () =>
      fetchClient<SavedDebatesResponse>(
        `/api/debates/saved?limit=${limit}&offset=${offset}`
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
