'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchClient } from '@/lib/api/fetchClient'

export interface MessageUser {
  id: string
  username: string
  avatarUrl: string | null
}

export interface Conversation {
  id: string
  user1Id: string
  user2Id: string
  lastMessageAt: string | null
  user1: MessageUser
  user2: MessageUser
  messages: Array<{ id: string; content: string; createdAt: string }>
  unreadCount: number
  otherUser: MessageUser
}

export interface DirectMessage {
  id: string
  content: string
  senderId: string
  receiverId: string
  isRead: boolean
  createdAt: string
  sender: MessageUser
  receiver: MessageUser
}

interface ConversationsResponse {
  conversations: Conversation[]
}

interface MessagesResponse {
  messages: DirectMessage[]
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await fetchClient<ConversationsResponse>('/api/messages/conversations')
      return data.conversations
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery<DirectMessage[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const data = await fetchClient<MessagesResponse>(
        `/api/messages/conversations/${conversationId}/messages`
      )
      return data.messages
    },
    enabled: !!conversationId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}
