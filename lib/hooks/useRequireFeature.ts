'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFeatureFlags } from '@/lib/contexts/FeatureFlagContext'

/**
 * Client-side feature gate — redirects to home if the feature is disabled.
 * Use this in 'use client' pages where server-side requireFeature() can't be called.
 * Returns true if the feature is enabled (safe to render), false if redirecting.
 */
export function useRequireFeature(featureKey: string): boolean {
  const { isEnabled, isLoaded } = useFeatureFlags()
  const router = useRouter()
  const enabled = isEnabled(featureKey)

  useEffect(() => {
    if (isLoaded && !enabled) {
      router.replace('/')
    }
  }, [isLoaded, enabled, router])

  return enabled
}
