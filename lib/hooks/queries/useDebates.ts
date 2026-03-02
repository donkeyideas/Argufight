'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'
import type { Debate } from './useDebate'

interface DebatesFilters {
  status?: string
  category?: string
  userId?: string
  page?: number
  limit?: number
}

interface DebatesResponse {
  debates: Debate[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function useDebates(filters: DebatesFilters = {}) {
  const { status, category, userId, page = 1, limit = 20 } = filters

  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.set('status', status)
  if (category && category !== 'ALL') params.set('category', category)
  if (userId) params.set('userId', userId)
  params.set('page', String(page))
  params.set('limit', String(limit))

  return useQuery<DebatesResponse>({
    queryKey: ['debates', { status, category, userId, page, limit }],
    queryFn: () => fetchClient<DebatesResponse>(`/api/debates?${params}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
