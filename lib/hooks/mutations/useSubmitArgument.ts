'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

interface SubmitArgumentParams {
  debateId: string
  content: string
  round: number
}

export function useSubmitArgument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ debateId, content, round }: SubmitArgumentParams) =>
      fetchClient(`/api/debates/${debateId}/statements`, {
        method: 'POST',
        body: JSON.stringify({ content, round }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['debate', variables.debateId] })
    },
  })
}
