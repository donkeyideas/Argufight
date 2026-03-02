'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'
import type { UserProfile } from '../queries/useProfile'

interface UpdateProfileParams {
  username?: string
  bio?: string
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: UpdateProfileParams) =>
      fetchClient<{ user: UserProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(params),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', 'me'], data.user)
      queryClient.invalidateQueries({ queryKey: ['navData'] })
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('avatar', file)
      return fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) throw new Error('Upload failed')
        return res.json()
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['navData'] })
    },
  })
}
