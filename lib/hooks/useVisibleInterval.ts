'use client'

import { useEffect, useRef } from 'react'

/**
 * Like setInterval, but only fires when the tab is visible.
 * Triggers an immediate callback when the tab returns from being hidden.
 */
export function useVisibleInterval(callback: () => void, ms: number) {
  const savedCallback = useRef(callback)
  const wasHiddenRef = useRef(false)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }

    // Track when tab is hidden so we only refetch on actual tab-switch, not every click
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false
        savedCallback.current()
      }
    }

    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [ms])
}
