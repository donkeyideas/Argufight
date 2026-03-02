import { NextRequest, NextResponse } from 'next/server';

// GET /api/debates/templates - Get debate templates
export async function GET(request: NextRequest) {
  try {
    const templates = [
      {
        id: 'tech_ai',
        category: 'TECH',
        topic: 'Artificial Intelligence will do more harm than good',
        description: 'Debate the impact of AI on society, economy, and humanity.',
        challengerPosition: 'FOR',
      },
      {
        id: 'politics_climate',
        category: 'POLITICS',
        topic: 'Climate change should be the top priority for all governments',
        description: 'Discuss the urgency and importance of climate action.',
        challengerPosition: 'FOR',
      },
      {
        id: 'sports_esports',
        category: 'SPORTS',
        topic: 'Esports should be considered a real sport',
        description: 'Debate whether competitive gaming qualifies as a sport.',
        challengerPosition: 'FOR',
      },
      {
        id: 'entertainment_streaming',
        category: 'ENTERTAINMENT',
        topic: 'Streaming services have improved the entertainment industry',
        description: 'Discuss the impact of streaming on traditional media.',
        challengerPosition: 'FOR',
      },
      {
        id: 'science_space',
        category: 'SCIENCE',
        topic: 'Space exploration is worth the cost',
        description: 'Debate the value and necessity of space programs.',
        challengerPosition: 'FOR',
      },
      {
        id: 'tech_social',
        category: 'TECH',
        topic: 'Social media has had a net positive impact on society',
        description: 'Evaluate the overall effects of social media platforms.',
        challengerPosition: 'FOR',
      },
      {
        id: 'politics_education',
        category: 'POLITICS',
        topic: 'Higher education should be free for all',
        description: 'Debate the accessibility and funding of education.',
        challengerPosition: 'FOR',
      },
      {
        id: 'science_gmo',
        category: 'SCIENCE',
        topic: 'Genetically modified foods are safe and beneficial',
        description: 'Discuss the safety and benefits of GMO technology.',
        challengerPosition: 'FOR',
      },
    ];

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}











