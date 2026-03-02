'use client'

import { useAuthContext } from '@/lib/contexts/AuthContext'

export function useAuth() {
  return useAuthContext()
}
