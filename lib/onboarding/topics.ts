export interface OnboardingTopic {
  topic: string
  forLabel: string
  againstLabel: string
}

export const ONBOARDING_TOPICS: Record<string, OnboardingTopic[]> = {
  SPORTS: [
    { topic: 'Is basketball more entertaining than soccer?', forLabel: 'Basketball wins', againstLabel: 'Soccer wins' },
    { topic: 'Should college athletes be paid?', forLabel: 'Yes, pay them', againstLabel: 'No, keep it amateur' },
    { topic: 'Is the NFL better than the NBA?', forLabel: 'NFL is better', againstLabel: 'NBA is better' },
    { topic: 'Will AI ever replace human referees?', forLabel: 'Yes, eventually', againstLabel: 'No, never' },
  ],
  POLITICS: [
    { topic: 'Should voting be mandatory?', forLabel: 'Yes, mandatory', againstLabel: 'No, voluntary' },
    { topic: 'Is social media good for democracy?', forLabel: 'Good for democracy', againstLabel: 'Bad for democracy' },
    { topic: 'Should the voting age be lowered to 16?', forLabel: 'Yes, lower it', againstLabel: 'No, keep it at 18' },
    { topic: 'Are term limits good for politicians?', forLabel: 'Yes, essential', againstLabel: 'No, unnecessary' },
  ],
  TECH: [
    { topic: 'Will AI replace most jobs in 10 years?', forLabel: 'Yes, it will', againstLabel: 'No, it won\'t' },
    { topic: 'Is social media doing more harm than good?', forLabel: 'More harm', againstLabel: 'More good' },
    { topic: 'Should smartphones be banned in schools?', forLabel: 'Yes, ban them', againstLabel: 'No, allow them' },
    { topic: 'Is open source better than proprietary software?', forLabel: 'Open source wins', againstLabel: 'Proprietary wins' },
  ],
  ENTERTAINMENT: [
    { topic: 'Are movies better than TV series?', forLabel: 'Movies are better', againstLabel: 'TV series are better' },
    { topic: 'Is streaming killing the cinema experience?', forLabel: 'Yes, killing it', againstLabel: 'No, they coexist' },
    { topic: 'Are video games art?', forLabel: 'Yes, they are art', againstLabel: 'No, just entertainment' },
    { topic: 'Should there be an age limit on social media?', forLabel: 'Yes, set limits', againstLabel: 'No, let people decide' },
  ],
  SCIENCE: [
    { topic: 'Should we colonize Mars?', forLabel: 'Yes, colonize', againstLabel: 'No, fix Earth first' },
    { topic: 'Is nuclear energy the best solution to climate change?', forLabel: 'Yes, go nuclear', againstLabel: 'No, renewables only' },
    { topic: 'Should human gene editing be allowed?', forLabel: 'Yes, allow it', againstLabel: 'No, too risky' },
    { topic: 'Are electric cars really better for the environment?', forLabel: 'Yes, much better', againstLabel: 'No, not really' },
  ],
  MUSIC: [
    { topic: 'Is hip-hop the most influential genre of all time?', forLabel: 'Yes, most influential', againstLabel: 'No, other genres too' },
    { topic: 'Are live concerts better than studio recordings?', forLabel: 'Live is better', againstLabel: 'Studio is better' },
    { topic: 'Has autotune ruined modern music?', forLabel: 'Yes, ruined it', againstLabel: 'No, it\'s a tool' },
    { topic: 'Is vinyl better than digital music?', forLabel: 'Vinyl is better', againstLabel: 'Digital is better' },
  ],
  OTHER: [
    { topic: 'Is pineapple acceptable on pizza?', forLabel: 'Yes, delicious', againstLabel: 'No, never' },
    { topic: 'Is a hot dog a sandwich?', forLabel: 'Yes, sandwich', againstLabel: 'No, it\'s not' },
    { topic: 'Should homework be abolished?', forLabel: 'Yes, abolish it', againstLabel: 'No, keep it' },
    { topic: 'Is it better to be a morning person or a night owl?', forLabel: 'Morning person', againstLabel: 'Night owl' },
  ],
}
