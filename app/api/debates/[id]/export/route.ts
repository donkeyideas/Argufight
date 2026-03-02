import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/[id]/export - Export debate as text/markdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const debate = await prisma.debate.findUnique({
      where: { id },
      include: {
        challenger: {
          select: {
            username: true,
            eloRating: true,
          },
        },
        opponent: {
          select: {
            username: true,
            eloRating: true,
          },
        },
        statements: {
          include: {
            author: {
              select: {
                username: true,
              },
            },
          },
          orderBy: [
            { round: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        verdicts: {
          include: {
            judge: {
              select: {
                name: true,
                emoji: true,
                personality: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    // Format as markdown
    let markdown = `# ${debate.topic}\n\n`;
    
    if (debate.description) {
      markdown += `${debate.description}\n\n`;
    }

    markdown += `**Category:** ${debate.category}\n`;
    markdown += `**Status:** ${debate.status}\n`;
    markdown += `**Created:** ${new Date(debate.createdAt).toLocaleString()}\n\n`;

    // Participants
    markdown += `## Participants\n\n`;
    markdown += `**Challenger:** ${debate.challenger.username} (ELO: ${debate.challenger.eloRating}) - ${debate.challengerPosition}\n`;
    if (debate.opponent) {
      markdown += `**Opponent:** ${debate.opponent.username} (ELO: ${debate.opponent.eloRating}) - ${debate.opponentPosition}\n`;
    }
    markdown += `\n`;

    // Statements
    if (debate.statements.length > 0) {
      markdown += `## Arguments\n\n`;
      let currentRound = 0;
      debate.statements.forEach((statement: any) => {
        if (statement.round !== currentRound) {
          currentRound = statement.round;
          markdown += `### Round ${currentRound}\n\n`;
        }
        markdown += `**${statement.author.username} (${statement.authorId === debate.challengerId ? debate.challengerPosition : debate.opponentPosition}):**\n\n`;
        markdown += `${statement.content}\n\n`;
        markdown += `*Submitted: ${new Date(statement.createdAt).toLocaleString()}*\n\n`;
      });
    }

    // Verdicts
    if (debate.verdicts.length > 0) {
      markdown += `## Verdicts\n\n`;
      debate.verdicts.forEach((verdict: any) => {
        markdown += `### ${verdict.judge.emoji} ${verdict.judge.name} (${verdict.judge.personality})\n\n`;
        markdown += `**Decision:** ${verdict.decision}\n\n`;
        if (verdict.challengerScore !== null && verdict.opponentScore !== null) {
          markdown += `**Scores:**\n`;
          markdown += `- ${debate.challenger.username}: ${verdict.challengerScore}\n`;
          if (debate.opponent) {
            markdown += `- ${debate.opponent.username}: ${verdict.opponentScore}\n`;
          }
          markdown += `\n`;
        }
        markdown += `**Reasoning:**\n\n${verdict.reasoning}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Return as text/plain for easy copying
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="debate-${id}.md"`,
      },
    });
  } catch (error) {
    console.error('Failed to export debate:', error);
    return NextResponse.json(
      { error: 'Failed to export debate' },
      { status: 500 }
    );
  }
}











