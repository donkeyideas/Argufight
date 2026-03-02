'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'

interface DailyRewardStatus {
  rewarded: boolean
  rewardAmount: number
  streak: number
  longestStreak: number
  totalLoginDays: number
}

const STORAGE_KEY = 'daily-login-reward-date'

/**
 * Get today's date string in UTC (YYYY-MM-DD)
 */
function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Hook to automatically claim daily login reward when user is authenticated.
 * Uses localStorage to avoid spamming the API on every page navigation.
 */
export function useDailyLoginReward(enabled: boolean = true) {
  const { user, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<DailyRewardStatus | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !isAuthenticated || !user) {
      return
    }

    // Check localStorage to see if we already claimed today (avoids unnecessary API calls)
    const lastClaimDate = localStorage.getItem(STORAGE_KEY)
    const today = getTodayUTC()
    if (lastClaimDate === today) {
      return
    }

    const claimReward = async () => {
      if (isClaiming) {
        return
      }

      setIsClaiming(true)
      setError(null)

      try {
        const response = await fetch('/api/rewards/daily-login', {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || 'Failed to claim daily reward')
        }

        const data = await response.json()

        setStatus({
          rewarded: data.rewarded || false,
          rewardAmount: data.rewardAmount || 0,
          streak: data.streak || 0,
          longestStreak: data.longestStreak || 0,
          totalLoginDays: data.totalLoginDays || 0,
        })

        // Mark today as claimed in localStorage (even if already rewarded server-side)
        localStorage.setItem(STORAGE_KEY, today)

        // If rewarded, refresh user data to update coin balance in UI
        if (data.rewarded && data.rewardAmount > 0) {
          window.dispatchEvent(new Event('user-logged-in'))
          localStorage.setItem('auth-refresh', Date.now().toString())
        }
      } catch (err) {
        console.error('[useDailyLoginReward] Error claiming reward:', err)
        setError(err instanceof Error ? err.message : 'Failed to claim reward')
      } finally {
        setIsClaiming(false)
      }
    }

    // Small delay to ensure session is fully established
    const timer = setTimeout(() => {
      claimReward()
    }, 1000)

    return () => clearTimeout(timer)
  }, [enabled, isAuthenticated, user?.id])

  return {
    status,
    isClaiming,
    error,
    claimed: status?.rewarded || false,
    rewardAmount: status?.rewardAmount || 0,
  }
}
