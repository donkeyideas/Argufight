/**
 * Championship Format Advancement Logic
 * Handles score-based advancement for Championship format tournaments
 */

import { prisma } from '@/lib/db/prisma'

export interface ParticipantScoreData {
  participantId: string
  userId: string
  selectedPosition: string | null
  score: number | null // Average score from Round 1 match
  scoreDifferential: number // How much they won/lost by
  matchWon: boolean // Did they win their match?
  eloRating: number
  registeredAt: Date
}

/**
 * Calculate which participants advance from Round 1 in Championship format
 * Advancement is based on individual scores within position groups, not match wins
 */
export async function calculateChampionshipAdvancement(
  tournamentId: string,
  roundNumber: number
): Promise<string[]> {
  // Only applies to Round 1
  if (roundNumber !== 1) {
    throw new Error('Championship advancement calculation only applies to Round 1')
  }

  // Get tournament and Round 1 matches
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              eloRating: true,
            },
          },
        },
      },
      rounds: {
        where: { roundNumber: 1 },
        include: {
          matches: {
            include: {
              participant1: {
                include: {
                  user: true,
                },
              },
              participant2: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  if (tournament.format !== 'CHAMPIONSHIP') {
    throw new Error('This function is only for Championship format tournaments')
  }

  const round1 = tournament.rounds[0]
  if (!round1) {
    throw new Error('Round 1 not found')
  }

  // Build participant score data from matches
  const participantScores: Map<string, ParticipantScoreData> = new Map()

  for (const match of round1.matches) {
    // Get scores from match
    const p1Score = match.participant1Score
    const p2Score = match.participant2Score

    // Determine who won the match
    const p1Won = match.winnerId === match.participant1Id
    const p2Won = match.winnerId === match.participant2Id

    // Calculate score differential (how much they won/lost by)
    const p1Differential = p1Score !== null && p2Score !== null ? p1Score - p2Score : 0
    const p2Differential = p2Score !== null && p1Score !== null ? p2Score - p1Score : 0

    // Store participant 1 data
    participantScores.set(match.participant1Id, {
      participantId: match.participant1Id,
      userId: match.participant1.userId,
      selectedPosition: match.participant1.selectedPosition,
      score: p1Score,
      scoreDifferential: p1Differential,
      matchWon: p1Won,
      eloRating: match.participant1.user.eloRating,
      registeredAt: match.participant1.registeredAt,
    })

    // Store participant 2 data
    participantScores.set(match.participant2Id, {
      participantId: match.participant2Id,
      userId: match.participant2.userId,
      selectedPosition: match.participant2.selectedPosition,
      score: p2Score,
      scoreDifferential: p2Differential,
      matchWon: p2Won,
      eloRating: match.participant2.user.eloRating,
      registeredAt: match.participant2.registeredAt,
    })
  }

  // Group by position
  const proParticipants: ParticipantScoreData[] = []
  const conParticipants: ParticipantScoreData[] = []

  for (const data of participantScores.values()) {
    if (data.selectedPosition === 'PRO') {
      proParticipants.push(data)
    } else if (data.selectedPosition === 'CON') {
      conParticipants.push(data)
    }
  }

  // Sort by score (descending) within each position group
  // Participants with null scores go to the bottom
  const sortByScore = (a: ParticipantScoreData, b: ParticipantScoreData) => {
    // Handle null scores
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1 // a goes to bottom
    if (b.score === null) return -1 // b goes to bottom

    // Sort by score descending
    return b.score! - a.score!
  }

  proParticipants.sort(sortByScore)
  conParticipants.sort(sortByScore)

  // Calculate how many advance from each position (50% of participants per position)
  const maxPerPosition = tournament.maxParticipants / 2
  const advanceCount = Math.floor(maxPerPosition / 2) // Top 50% from each position

  // Select top N from each position, applying tiebreakers if needed
  const advancingPro = selectAdvancingParticipants(proParticipants, advanceCount)
  const advancingCon = selectAdvancingParticipants(conParticipants, advanceCount)

  // Combine and return participant IDs
  const advancingParticipantIds = [
    ...advancingPro.map((p) => p.participantId),
    ...advancingCon.map((p) => p.participantId),
  ]

  console.log(
    `[Championship Advancement] Round 1: ${advancingParticipantIds.length} participants advancing (${advancingPro.length} PRO, ${advancingCon.length} CON)`
  )

  return advancingParticipantIds
}

/**
 * Select advancing participants from a sorted list, applying tiebreakers when scores are equal
 */
function selectAdvancingParticipants(
  participants: ParticipantScoreData[],
  count: number
): ParticipantScoreData[] {
  if (participants.length <= count) {
    return participants // All advance if not enough participants
  }

  const advancing: ParticipantScoreData[] = []
  let currentIndex = 0

  while (advancing.length < count && currentIndex < participants.length) {
    const currentScore = participants[currentIndex].score

    // Find all participants with the same score
    const sameScoreGroup: ParticipantScoreData[] = []
    while (
      currentIndex < participants.length &&
      participants[currentIndex].score === currentScore
    ) {
      sameScoreGroup.push(participants[currentIndex])
      currentIndex++
    }

    // If we can fit all of this score group, add them all
    if (advancing.length + sameScoreGroup.length <= count) {
      // Sort by tiebreakers and add all
      const sorted = applyTiebreakers(sameScoreGroup)
      advancing.push(...sorted)
    } else {
      // We can only fit some of this group - apply tiebreakers to decide
      const needed = count - advancing.length
      const sorted = applyTiebreakers(sameScoreGroup)
      advancing.push(...sorted.slice(0, needed))
      break
    }
  }

  return advancing
}

/**
 * Apply tiebreaker chain to participants with the same score
 * 1. Match winner (if one won and one lost)
 * 2. Score differential (who won/lost by more points)
 * 3. Higher ELO rating
 * 4. Earlier registration time
 */
function applyTiebreakers(participants: ParticipantScoreData[]): ParticipantScoreData[] {
  if (participants.length <= 1) {
    return participants
  }

  return [...participants].sort((a, b) => {
    // Tiebreaker 1: Match winner
    if (a.matchWon && !b.matchWon) return -1 // a wins
    if (!a.matchWon && b.matchWon) return 1 // b wins

    // Tiebreaker 2: Score differential (who won/lost by more)
    if (a.scoreDifferential !== b.scoreDifferential) {
      return b.scoreDifferential - a.scoreDifferential // Higher differential wins
    }

    // Tiebreaker 3: Higher ELO rating
    if (a.eloRating !== b.eloRating) {
      return b.eloRating - a.eloRating // Higher ELO wins
    }

    // Tiebreaker 4: Earlier registration time
    const timeDiff = a.registeredAt.getTime() - b.registeredAt.getTime()
    if (timeDiff !== 0) {
      return timeDiff // Earlier registration wins
    }

    // Ultimate fallback: Random selection (with logging)
    console.warn(
      `[Championship Tiebreaker] All tiebreakers exhausted for participants ${a.participantId} and ${b.participantId}. Using random selection.`
    )
    return Math.random() - 0.5 // Random order
  })
}

