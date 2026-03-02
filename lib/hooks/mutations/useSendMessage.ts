'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'
import type { DirectMessage } from '../queries/useMessages'

interface SendMessageParams {
  conversationId: string
  content: string
}

interface SendMessageResponse {
  message: DirectMessage
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ conversationId, content }: SendMessageParams) =>
      fetchClient<SendMessageResponse>(
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

interface StartConversationParams {
  otherUserId: string
}

interface StartConversationResponse {
  conversation: {
    id: string
    user1Id: string
    user2Id: string
    lastMessageAt: string | null
    user1: { id: string; username: string; avatarUrl: string | null }
    user2: { id: string; username: string; avatarUrl: string | null }
  }
}

export function useStartConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ otherUserId }: StartConversationParams) =>
      fetchClient<StartConversationResponse>('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ otherUserId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
