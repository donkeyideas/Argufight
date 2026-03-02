'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { FEATURE_KEYS } from '@/lib/features'

type FeatureFlags = Record<string, boolean>

interface FeatureFlagContextType {
  flags: FeatureFlags
  isLoaded: boolean
  isEnabled: (key: string) => boolean
}

// Build default flags client-side (business modules off, rest on)
const DEFAULT_CLIENT_FLAGS: FeatureFlags = {}
for (const key of Object.values(FEATURE_KEYS)) {
  DEFAULT_CLIENT_FLAGS[key] = !key.includes('SUBSCRIPTIONS') &&
    !key.includes('COIN_PURCHASES') &&
    !key.includes('ADVERTISING') &&
    !key.includes('CREATOR_MARKETPLACE') &&
    !key.includes('AI_MARKETING')
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: DEFAULT_CLIENT_FLAGS,
  isLoaded: false,
  isEnabled: () => true,
})

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_CLIENT_FLAGS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadFlags() {
      try {
        const res = await fetch('/api/features')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setFlags(data)
          setIsLoaded(true)
        }
      } catch {
        // Use defaults on error
        if (!cancelled) {
          setIsLoaded(true)
        }
      }
    }

    loadFlags()
    return () => { cancelled = true }
  }, [])

  // Allow dashboard-data response to hydrate flags without an extra fetch
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail === 'object') {
        setFlags(detail)
        setIsLoaded(true)
      }
    }
    window.addEventListener('feature-flags-loaded', handler)
    return () => window.removeEventListener('feature-flags-loaded', handler)
  }, [])

  const isEnabled = useCallback(
    (key: string) => flags[key] ?? true,
    [flags]
  )

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoaded, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext)
}
