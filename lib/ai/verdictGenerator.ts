/**
 * Enhanced verdict generation with better AI integration
 * Can be extended to use actual LLM APIs
 */

import { logger } from '@/lib/utils/logger';

interface DebateData {
  topic: string;
  description?: string;
  challengerPosition: string;
  opponentPosition: string;
  statements: Array<{
    authorId: string;
    round: number;
    content: string;
  }>;
  challenger: { id: string; username: string };
  opponent?: { id: string; username: string };
}

interface JudgePersonality {
  id: string;
  name: string;
  personality: string;
  systemPrompt: string;
}

interface VerdictResult {
  winnerId: string | null;
  decision: 'CHALLENGER_WINS' | 'OPPONENT_WINS' | 'TIE';
  reasoning: string;
  challengerScore: number;
  opponentScore: number;
}

/**
 * Analyze debate statements and generate a verdict
 * This is a placeholder that can be replaced with actual LLM calls
 */
export async function generateVerdict(
  debateData: DebateData,
  judge: JudgePersonality
): Promise<VerdictResult> {
  logger.info('Generating verdict', {
    judge: judge.name,
    debateTopic: debateData.topic,
  });

  try {
    // Group statements by author
    const challengerStatements = debateData.statements.filter(
      (s) => s.authorId === debateData.challenger.id
    );
    const opponentStatements = debateData.statements.filter(
      (s) => s.authorId === debateData.opponent?.id
    );

    // Enhanced scoring algorithm
    // In production, this would call an LLM API with the judge's system prompt
    const challengerScore = calculateScore(challengerStatements, judge);
    const opponentScore = calculateScore(opponentStatements, judge);

    // Determine winner
    let winnerId: string | null = null;
    let decision: 'CHALLENGER_WINS' | 'OPPONENT_WINS' | 'TIE';

    const scoreDifference = Math.abs(challengerScore - opponentScore);
    const threshold = 0.1; // 10% difference required to win

    if (scoreDifference < threshold) {
      decision = 'TIE';
    } else if (challengerScore > opponentScore) {
      winnerId = debateData.challenger.id;
      decision = 'CHALLENGER_WINS';
    } else {
      winnerId = debateData.opponent?.id || null;
      decision = 'OPPONENT_WINS';
    }

    // Generate reasoning based on judge personality
    const reasoning = generateReasoning(
      debateData,
      judge,
      challengerScore,
      opponentScore,
      decision
    );

    return {
      winnerId,
      decision,
      reasoning,
      challengerScore,
      opponentScore,
    };
  } catch (error) {
    logger.error('Failed to generate verdict', error as Error, { judge: judge.name });
    throw error;
  }
}

/**
 * Calculate score for a set of statements
 * Enhanced algorithm considering:
 * - Content length (more detailed arguments score higher)
 * - Round progression (later rounds weighted more)
 * - Argument structure (sentences, paragraphs)
 */
function calculateScore(
  statements: Array<{ round: number; content: string }>,
  judge: JudgePersonality
): number {
  if (statements.length === 0) return 0;

  let totalScore = 0;

  for (const statement of statements) {
    const content = statement.content;
    const round = statement.round;

    // Base score from content length (normalized)
    const lengthScore = Math.min(content.length / 1000, 1) * 0.4;

    // Round weight (later rounds are more important)
    const roundWeight = 0.3 + (round * 0.1);

    // Structure score (sentences, paragraphs)
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const structureScore = Math.min((sentences.length * 0.1 + paragraphs.length * 0.2), 0.3);

    // Judge personality modifier (placeholder - would use LLM in production)
    const personalityModifier = getPersonalityModifier(judge.personality, content);

    const statementScore = (lengthScore + structureScore) * roundWeight * personalityModifier;
    totalScore += statementScore;
  }

  // Normalize to 0-100 scale
  return Math.min(totalScore * 20, 100);
}

/**
 * Get personality modifier based on judge type
 * In production, this would be determined by LLM analysis
 */
function getPersonalityModifier(personality: string, content: string): number {
  const lowerPersonality = personality.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Empiricist favors data and evidence
  if (lowerPersonality.includes('empiricist')) {
    const hasNumbers = /\d+/.test(content);
    const hasEvidence = /evidence|data|study|research|statistic/i.test(content);
    return hasNumbers || hasEvidence ? 1.2 : 0.9;
  }

  // Rhetorician favors persuasive language
  if (lowerPersonality.includes('rhetorician')) {
    const hasPersuasive = /therefore|consequently|clearly|obviously|undoubtedly/i.test(content);
    return hasPersuasive ? 1.15 : 0.95;
  }

  // Logician favors logical structure
  if (lowerPersonality.includes('logician')) {
    const hasLogic = /if|then|therefore|because|since|thus/i.test(content);
    return hasLogic ? 1.1 : 0.95;
  }

  // Default modifier
  return 1.0;
}

/**
 * Generate reasoning text based on verdict
 */
function generateReasoning(
  debateData: DebateData,
  judge: JudgePersonality,
  challengerScore: number,
  opponentScore: number,
  decision: string
): string {
  const challengerStatements = debateData.statements.filter(
    (s) => s.authorId === debateData.challenger.id
  );
  const opponentStatements = debateData.statements.filter(
    (s) => s.authorId === debateData.opponent?.id
  );

  const winnerName =
    decision === 'CHALLENGER_WINS'
      ? debateData.challenger.username
      : decision === 'OPPONENT_WINS'
      ? debateData.opponent?.username
      : 'neither participant';

  return `${judge.name} analyzed this debate on "${debateData.topic}" with a ${judge.personality} perspective. After reviewing ${challengerStatements.length} statements from ${debateData.challenger.username} (${challengerScore.toFixed(1)}/100) and ${opponentStatements.length} statements from ${debateData.opponent?.username || 'opponent'} (${opponentScore.toFixed(1)}/100), ${judge.name} determined that ${winnerName} presented the stronger argument. The decision reflects ${judge.name.toLowerCase()}'s emphasis on ${judge.personality.toLowerCase()} principles.`;
}

/**
 * Call external LLM API (placeholder for future implementation)
 */
async function callLLMAPI(
  systemPrompt: string,
  userPrompt: string,
  debateData: DebateData
): Promise<VerdictResult> {
  // TODO: Implement actual LLM API call
  // Example with OpenAI:
  // const response = await openai.chat.completions.create({
  //   model: "gpt-4",
  //   messages: [
  //     { role: "system", content: systemPrompt },
  //     { role: "user", content: userPrompt }
  //   ]
  // });

  logger.warn('LLM API not configured, using fallback scoring');
  throw new Error('LLM API not implemented');
}










