import { prisma } from './prisma'
import type { 
  DebateStatus, 
  DebateCategory, 
  NotificationType,
  VerdictDecision 
} from '@prisma/client'

// ============================================
// USER QUERIES
// ============================================

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      challengerDebates: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      opponentDebates: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
  })
}

export async function getLeaderboard(limit = 50) {
  return prisma.user.findMany({
    orderBy: { eloRating: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      eloRating: true,
      debatesWon: true,
      debatesLost: true,
      debatesTied: true,
      totalDebates: true,
    },
  })
}

// ============================================
// DEBATE QUERIES
// ============================================

export async function getDebateById(debateId: string) {
  return prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          eloRating: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          eloRating: true,
        },
      },
      statements: {
        orderBy: { round: 'asc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      },
      verdicts: {
        include: {
          judge: true,
        },
      },
    },
  })
}

export async function getDebatesByStatus(status: DebateStatus, limit = 20) {
  return prisma.debate.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export async function getDebatesByCategory(category: DebateCategory, limit = 20) {
  return prisma.debate.findMany({
    where: { category },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export async function getFeaturedDebates(limit = 10) {
  return prisma.debate.findMany({
    where: { featured: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })
}

export async function getWaitingDebates(limit = 20) {
  return prisma.debate.findMany({
    where: { 
      status: 'WAITING',
      opponentId: null,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          eloRating: true,
        },
      },
    },
  })
}

// ============================================
// JUDGE QUERIES
// ============================================

export async function getAllJudges() {
  return prisma.judge.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getJudgeById(judgeId: string) {
  return prisma.judge.findUnique({
    where: { id: judgeId },
  })
}

// ============================================
// VERDICT QUERIES
// ============================================

export async function getVerdictsByDebate(debateId: string) {
  return prisma.verdict.findMany({
    where: { debateId },
    include: {
      judge: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ============================================
// NOTIFICATION QUERIES
// ============================================

export async function getUserNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      debate: {
        select: {
          id: true,
          topic: true,
        },
      },
    },
  })
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  })
}

// ============================================
// CHAT QUERIES
// ============================================

export async function getChatMessages(debateId: string, limit = 50) {
  return prisma.chatMessage.findMany({
    where: {
      debateId,
      deleted: false,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })
}

// ============================================
// STATISTICS QUERIES
// ============================================

export async function getPlatformStats() {
  const [
    totalUsers,
    totalDebates,
    activeDebates,
    completedDebates,
    totalVerdicts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.debate.count(),
    prisma.debate.count({ where: { status: 'ACTIVE' } }),
    prisma.debate.count({ where: { status: 'COMPLETED' } }),
    prisma.verdict.count(),
  ])

  return {
    totalUsers,
    totalDebates,
    activeDebates,
    completedDebates,
    totalVerdicts,
  }
}










