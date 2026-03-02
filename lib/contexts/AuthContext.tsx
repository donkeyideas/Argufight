'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface User {
  id: string
  email: string
  username: string
  avatarUrl: string | null
  bio: string | null
  eloRating: number
  debatesWon: number
  debatesLost: number
  debatesTied: number
  totalDebates: number
  totalScore: number
  totalMaxScore: number
  isAdmin: boolean
  isBanned: boolean
  isCreator?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  refetch: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeUser(data: any): User {
  return {
    ...data,
    avatarUrl: data.avatarUrl || data.avatar_url || null,
    eloRating: data.eloRating || data.elo_rating || 0,
    debatesWon: data.debatesWon || data.debates_won || 0,
    debatesLost: data.debatesLost || data.debates_lost || 0,
    debatesTied: data.debatesTied || data.debates_tied || 0,
    totalDebates: data.totalDebates || data.total_debates || 0,
    totalScore: data.totalScore || data.total_score || 0,
    totalMaxScore: data.totalMaxScore || data.total_max_score || 0,
    isCreator: data.isCreator || data.is_creator || false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async (skipCache = false) => {
    try {
      // Check sessionStorage cache to avoid redundant fetches on soft navigation
      if (!skipCache) {
        try {
          const cached = sessionStorage.getItem('auth-user-cache')
          if (cached) {
            const { user: cachedUser, ts } = JSON.parse(cached)
            if (Date.now() - ts < 5 * 60 * 1000) { // 5 min TTL
              setUser(cachedUser ? normalizeUser(cachedUser) : null)
              setIsLoading(false)
              return
            }
          }
        } catch { /* ignore cache errors */ }
      }

      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          const normalized = normalizeUser(data.user)
          setUser(normalized)
          try { sessionStorage.setItem('auth-user-cache', JSON.stringify({ user: data.user, ts: Date.now() })) } catch {}
        } else {
          setUser(null)
          try { sessionStorage.removeItem('auth-user-cache') } catch {}
        }
      } else {
        setUser(null)
        try { sessionStorage.removeItem('auth-user-cache') } catch {}
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()

    const handleLogin = () => fetchUser(true) // bypass cache on explicit login
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-refresh') fetchUser(true) // bypass cache on explicit refresh
    }

    window.addEventListener('user-logged-in', handleLogin)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('user-logged-in', handleLogin)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      refetch: fetchUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
