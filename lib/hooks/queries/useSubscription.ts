'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface Subscription {
  id?: string
  tier: 'FREE' | 'PRO'
  billingCycle?: 'MONTHLY' | 'YEARLY'
  status?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  cancelledAt?: string | null
}

export interface UsageItem {
  current: number
  limit: number
}

export interface SubscriptionUsage {
  usage: {
    appeals: UsageItem
    thatsTheOne: UsageItem
    tournamentCredits: UsageItem
    tournaments: UsageItem
  }
  usageArray: Array<{ featureType: string; count: number }>
  limits: {
    APPEALS: number
    THATS_THE_ONE: number
    TOURNAMENT_CREDITS: number
    TOURNAMENTS: number
  }
}

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const data = await fetchClient<{ subscription: Subscription }>('/api/subscriptions')
      return data.subscription
    },
    staleTime: 300_000,
  })
}

export function useUsage() {
  return useQuery<SubscriptionUsage>({
    queryKey: ['subscription', 'usage'],
    queryFn: () => fetchClient<SubscriptionUsage>('/api/subscriptions/usage'),
    staleTime: 60_000,
  })
}
