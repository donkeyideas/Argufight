'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface NavData {
  unreadCount: number
  tier: string
  isAdvertiser: boolean
  accountCount: number
  beltCount: number
  coinBalance: number
}

export function useNavData() {
  return useQuery<NavData>({
    queryKey: ['navData'],
    queryFn: () => fetchClient<NavData>('/api/nav-data'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
