'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface BeltChallenge {
  beltId: string
  beltName: string
  beltCategory: string | null
  opponentId: string
  opponentUsername: string
}

interface ChallengeContextType {
  challenge: BeltChallenge | null
  openChallenge: (challenge: BeltChallenge) => void
  closeChallenge: () => void
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined)

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challenge, setChallenge] = useState<BeltChallenge | null>(null)

  const openChallenge = (challenge: BeltChallenge) => {
    console.log('🚀 [ChallengeContext] Opening challenge:', challenge)
    setChallenge(challenge)
  }

  const closeChallenge = () => {
    console.log('🚀 [ChallengeContext] Closing challenge')
    setChallenge(null)
  }

  return (
    <ChallengeContext.Provider value={{ challenge, openChallenge, closeChallenge }}>
      {children}
    </ChallengeContext.Provider>
  )
}

export function useChallenge() {
  const context = useContext(ChallengeContext)
  if (!context) {
    // Return a no-op implementation during SSR/static generation
    // This prevents build errors when ChallengeProvider isn't available
    return {
      challenge: null,
      openChallenge: () => {
        if (typeof window !== 'undefined') {
          console.warn('Challenge context not available - ChallengeProvider may not be mounted')
        }
      },
      closeChallenge: () => {},
    }
  }
  return context
}
