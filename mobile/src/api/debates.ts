import { apiFetch } from './client';

export interface DebateParticipant {
  username: string;
  avatarUrl?: string | null;
}

export interface Debate {
  id: string;
  topic: string;
  category: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  spectatorCount: number;
  challengerId: string;
  opponentId: string | null;
  challenger: DebateParticipant;
  opponent: DebateParticipant | null;
  statements?: any[];
  createdAt: string;
  updatedAt: string;
}

// Raw shape returned by /api/dashboard-data (web format)
export interface DashboardData {
  activeDebates: { debates: any[] };
  userActiveDebates: { debates: any[] };
  waitingDebates: { debates: any[] };
  yourTurn: { hasTurn: boolean; debateId?: string; topic?: string; round?: number; deadline?: string } | null;
  nav: { coinBalance: number; unreadCount: number };
}

export const debatesApi = {
  getDashboardData: () =>
    apiFetch<DashboardData>('/api/dashboard-data'),

  getDebate: (id: string) =>
    apiFetch<Debate>(`/api/debates/${id}`),

  getTrending: (timeframe: '24h' | '7d' | '30d' = '24h') =>
    apiFetch<Debate[]>(`/api/debates/trending?timeframe=${timeframe}`),

  create: (data: {
    topic: string;
    category: string;
    challengerPosition?: 'FOR' | 'AGAINST';
    totalRounds?: number;
    challengeType?: 'OPEN' | 'DIRECT';
    invitedUserIds?: string[];
    isPrivate?: boolean;
  }) =>
    apiFetch<Debate>('/api/debates', { method: 'POST', body: data }),

  accept: (id: string) =>
    apiFetch(`/api/debates/${id}/accept`, { method: 'POST' }),

  submitStatement: (id: string, content: string, images?: string[]) =>
    apiFetch(`/api/debates/${id}/submit`, {
      method: 'POST',
      body: { content, images },
    }),

  getChat: (id: string) =>
    apiFetch(`/api/debates/${id}/chat`),

  sendChat: (id: string, message: string) =>
    apiFetch(`/api/debates/${id}/chat`, {
      method: 'POST',
      body: { message },
    }),

  spectate: (id: string) =>
    apiFetch(`/api/debates/${id}/spectate`, { method: 'POST' }),

  getVerdicts: (id: string) =>
    apiFetch(`/api/debates/${id}/verdicts`),

  like: (id: string) =>
    apiFetch(`/api/debates/${id}/like`, { method: 'POST' }),

  save: (id: string) =>
    apiFetch(`/api/debates/${id}/save`, { method: 'POST' }),

  getHistory: () =>
    apiFetch('/api/debates/history'),

  getSaved: () =>
    apiFetch('/api/debates/saved'),

  getDailyChallenge: () =>
    apiFetch<{ challenge: any; participationCount: number }>('/api/daily-challenge'),

  getCategories: () =>
    apiFetch('/api/categories'),

  search: (q: string) =>
    apiFetch(`/api/debates/search?q=${encodeURIComponent(q)}`),

  getComments: (id: string) =>
    apiFetch(`/api/debates/${id}/comments`),

  postComment: (id: string, content: string) =>
    apiFetch(`/api/debates/${id}/comments`, {
      method: 'POST',
      body: { content },
    }),
};
