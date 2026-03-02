/**
 * Feature constants for subscription tiers
 */

export const FEATURES = {
  // Free Tier Features
  STANDARD_DEBATES: 'standard_debates',
  CREATE_CHALLENGES: 'create_challenges',
  AI_JUDGES: 'ai_judges',
  ELO_RANKING: 'elo_ranking',
  WATCH_DEBATES: 'watch_debates',
  BASIC_STATS: 'basic_stats',
  FREE_TOURNAMENTS: 'free_tournaments',
  TOURNAMENTS: 'tournaments', // Tournament creation
  THATS_THE_ONE: 'thats_the_one', // 10/month for Free
  
  // Pro Tier Only Features
  SPEED_DEBATES: 'speed_debates',
  PRIORITY_MATCHMAKING: 'priority_matchmaking',
  FAST_TRACK_TOURNAMENTS: 'fast_track_tournaments',
  PERFORMANCE_DASHBOARD: 'performance_dashboard',
  ARGUMENT_QUALITY_SCORES: 'argument_quality_scores',
  JUDGE_PREFERENCE_ANALYSIS: 'judge_preference_analysis',
  OPPONENT_ANALYSIS: 'opponent_analysis',
  HISTORICAL_ELO_CHARTS: 'historical_elo_charts',
  TOURNAMENT_CREDITS: 'tournament_credits', // 4/month for Pro
  PRO_TOURNAMENTS: 'pro_tournaments',
  CUSTOM_TOURNAMENTS: 'custom_tournaments',
  APPEALS: 'appeals', // 12/month for Pro (vs 4 for Free)
  APPEAL_SUCCESS_TRACKING: 'appeal_success_tracking',
  BONUS_APPEAL_CREDITS: 'bonus_appeal_credits',
  THATS_THE_ONE_UNLIMITED: 'thats_the_one_unlimited',
  DEBATE_REPLAY_EXPORT: 'debate_replay_export',
  HIGHLIGHT_REELS: 'highlight_reels',
  CUSTOM_PROFILE_THEMES: 'custom_profile_themes',
  VERIFIED_BADGE: 'verified_badge',
  EARLY_ACCESS: 'early_access',
  NO_ADS: 'no_ads',
} as const

export const FEATURE_LIMITS = {
  FREE: {
    APPEALS: 4,
    THATS_THE_ONE: 10,
    TOURNAMENT_CREDITS: 0,
    TOURNAMENTS: 1, // 1 tournament per month for free users
  },
  PRO: {
    APPEALS: 12,
    THATS_THE_ONE: -1, // -1 means unlimited
    TOURNAMENT_CREDITS: 4, // per month, max 12 rollover
    TOURNAMENTS: -1, // -1 means unlimited for Pro
  },
} as const

export type FeatureType = typeof FEATURES[keyof typeof FEATURES]
export type TierType = 'FREE' | 'PRO'

