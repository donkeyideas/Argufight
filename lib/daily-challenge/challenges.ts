export interface DailyChallengeData {
  topic: string
  description: string
  category: string
  forLabel: string
  againstLabel: string
}

// Curated list of daily challenge topics — cycles through categories
// Each topic is designed to be engaging and accessible to a wide audience
export const DAILY_CHALLENGE_POOL: DailyChallengeData[] = [
  // SPORTS
  { topic: 'Is soccer the greatest sport in the world?', description: 'The beautiful game vs everything else.', category: 'SPORTS', forLabel: 'Yes, greatest', againstLabel: 'No way' },
  { topic: 'Should performance-enhancing drugs be allowed in sports?', description: 'Push the limits or keep it clean?', category: 'SPORTS', forLabel: 'Allow them', againstLabel: 'Keep it clean' },
  { topic: 'Are esports real sports?', description: 'Competitive gaming deserves the same recognition.', category: 'SPORTS', forLabel: 'Yes, real sports', againstLabel: 'Not real sports' },
  { topic: 'Should athletes be role models?', description: 'Great performance vs great character.', category: 'SPORTS', forLabel: 'Yes, always', againstLabel: 'No obligation' },
  { topic: 'Is the Olympics still relevant?', description: 'Tradition vs modern competition.', category: 'SPORTS', forLabel: 'Still relevant', againstLabel: 'Outdated' },

  // POLITICS
  { topic: 'Should there be a universal basic income?', description: 'Everyone gets a paycheck, no strings attached.', category: 'POLITICS', forLabel: 'Yes, implement UBI', againstLabel: 'No, bad idea' },
  { topic: 'Is democracy the best form of government?', description: 'Rule by the people vs alternatives.', category: 'POLITICS', forLabel: 'Best system', againstLabel: 'Not the best' },
  { topic: 'Should billionaires exist?', description: 'Extreme wealth in an unequal world.', category: 'POLITICS', forLabel: 'Yes, earned it', againstLabel: 'No, cap wealth' },
  { topic: 'Is cancel culture a problem?', description: 'Accountability or mob justice?', category: 'POLITICS', forLabel: 'Yes, it\'s a problem', againstLabel: 'No, it\'s accountability' },
  { topic: 'Should countries have open borders?', description: 'Freedom of movement for all.', category: 'POLITICS', forLabel: 'Open borders', againstLabel: 'Controlled borders' },

  // TECH
  { topic: 'Should AI art be considered real art?', description: 'Creativity meets algorithms.', category: 'TECH', forLabel: 'Yes, it\'s art', againstLabel: 'Not real art' },
  { topic: 'Is TikTok good for society?', description: 'Entertainment, education, or addiction?', category: 'TECH', forLabel: 'Good for society', againstLabel: 'Bad for society' },
  { topic: 'Should we fear superintelligent AI?', description: 'Existential risk or sci-fi fantasy?', category: 'TECH', forLabel: 'Yes, be afraid', againstLabel: 'No, overblown' },
  { topic: 'Is remote work better than office work?', description: 'Flexibility vs face-to-face collaboration.', category: 'TECH', forLabel: 'Remote is better', againstLabel: 'Office is better' },
  { topic: 'Should kids learn to code in school?', description: 'Programming as a core subject.', category: 'TECH', forLabel: 'Yes, mandatory', againstLabel: 'No, optional' },

  // ENTERTAINMENT
  { topic: 'Are superhero movies ruining cinema?', description: 'Marvel, DC, and the blockbuster machine.', category: 'ENTERTAINMENT', forLabel: 'Yes, ruining it', againstLabel: 'No, they\'re great' },
  { topic: 'Is reality TV harmful?', description: 'Guilty pleasure or cultural damage?', category: 'ENTERTAINMENT', forLabel: 'Yes, harmful', againstLabel: 'No, just fun' },
  { topic: 'Should there be a limit on movie sequels?', description: 'Original stories vs franchise fatigue.', category: 'ENTERTAINMENT', forLabel: 'Limit sequels', againstLabel: 'Let them roll' },
  { topic: 'Are book adaptations ever better than the book?', description: 'Screen vs page — which wins?', category: 'ENTERTAINMENT', forLabel: 'Sometimes better', againstLabel: 'Never better' },
  { topic: 'Is stand-up comedy harder than acting?', description: 'Raw comedy vs polished performance.', category: 'ENTERTAINMENT', forLabel: 'Comedy is harder', againstLabel: 'Acting is harder' },

  // SCIENCE
  { topic: 'Should we bring back extinct species?', description: 'De-extinction: playing God or saving nature?', category: 'SCIENCE', forLabel: 'Yes, bring them back', againstLabel: 'No, leave them' },
  { topic: 'Is space travel worth the cost?', description: 'Billions for the stars while Earth suffers.', category: 'SCIENCE', forLabel: 'Worth every penny', againstLabel: 'Waste of money' },
  { topic: 'Should we ban plastic completely?', description: 'Environmental disaster vs practical necessity.', category: 'SCIENCE', forLabel: 'Ban it all', againstLabel: 'We still need it' },
  { topic: 'Is organic food actually better?', description: 'Marketing hype or real health benefits?', category: 'SCIENCE', forLabel: 'Yes, better', againstLabel: 'No difference' },
  { topic: 'Should we terraform Mars?', description: 'Make Mars habitable or focus on Earth?', category: 'SCIENCE', forLabel: 'Terraform Mars', againstLabel: 'Focus on Earth' },

  // MUSIC
  { topic: 'Is modern pop music worse than older generations?', description: 'Nostalgia vs evolution of sound.', category: 'MUSIC', forLabel: 'Old was better', againstLabel: 'New is great' },
  { topic: 'Should music streaming pay artists more?', description: 'Fair compensation in the digital age.', category: 'MUSIC', forLabel: 'Pay more', againstLabel: 'It\'s fair enough' },
  { topic: 'Is talent more important than marketing in music?', description: 'Can you make it without the machine?', category: 'MUSIC', forLabel: 'Talent matters most', againstLabel: 'Marketing wins' },
  { topic: 'Should AI-generated music be on Spotify?', description: 'Algorithms making hits.', category: 'MUSIC', forLabel: 'Yes, allow it', againstLabel: 'No, ban it' },
  { topic: 'Are music festivals overrated?', description: 'The ultimate experience or overpriced chaos?', category: 'MUSIC', forLabel: 'Overrated', againstLabel: 'Worth every moment' },

  // OTHER
  { topic: 'Is breakfast the most important meal of the day?', description: 'Science, habit, or marketing myth?', category: 'OTHER', forLabel: 'Most important', againstLabel: 'Just a myth' },
  { topic: 'Should tipping culture be abolished?', description: 'Pay workers properly or keep tipping?', category: 'OTHER', forLabel: 'Abolish tipping', againstLabel: 'Keep tipping' },
  { topic: 'Is social media making us lonelier?', description: 'Connected online, disconnected IRL.', category: 'OTHER', forLabel: 'Yes, lonelier', againstLabel: 'No, more connected' },
  { topic: 'Should the workweek be 4 days?', description: 'Productivity vs traditional schedules.', category: 'OTHER', forLabel: '4-day week', againstLabel: '5 days is fine' },
  { topic: 'Is it okay to lie to spare someone\'s feelings?', description: 'White lies vs brutal honesty.', category: 'OTHER', forLabel: 'Yes, sometimes', againstLabel: 'No, always be honest' },
  { topic: 'Should zoos exist?', description: 'Conservation vs captivity.', category: 'OTHER', forLabel: 'Yes, keep zoos', againstLabel: 'No, end zoos' },
  { topic: 'Is fast fashion destroying the planet?', description: 'Cheap clothes, expensive consequences.', category: 'OTHER', forLabel: 'Yes, destroying it', againstLabel: 'It\'s not that bad' },
  { topic: 'Should homework exist?', description: 'Extra practice or wasted time?', category: 'OTHER', forLabel: 'Keep homework', againstLabel: 'Abolish it' },
  { topic: 'Are cats better pets than dogs?', description: 'The eternal debate.', category: 'OTHER', forLabel: 'Cats are better', againstLabel: 'Dogs are better' },
  { topic: 'Is college worth the cost?', description: 'Degree vs real-world experience.', category: 'OTHER', forLabel: 'Worth it', againstLabel: 'Not worth it' },
]
