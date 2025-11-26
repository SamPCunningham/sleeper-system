export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Campaign {
  id: number;
  name: string;
  gm_user_id: number;
  current_day: number;
  created_at: string;
}

export interface Character {
  id: number;
  campaign_id: number;
  user_id: number;
  name: string;
  skill_name: string | null;
  skill_modifier: number;
  weakness_name: string | null;
  weakness_modifier: number;
  max_daily_dice: number;
  created_at: string;
}

export interface PoolDie {
  id: number;
  pool_id: number;
  die_result: number;
  is_used: boolean;
  position: number;
}

export interface DicePool {
  id: number;
  character_id: number;
  rolled_at: string;
  dice: PoolDie[];
}

export interface RollHistory {
  id: number;
  character_id: number;
  pool_dice_id: number | null;
  d20_roll: number | null;
  action_type: string | null;
  success: boolean | null;
  outcome: string;
  notes: string | null;
  challenge_id: number | null;
  skill_applied: boolean;
  other_modifiers: number;
  modified_d6: number | null;
  created_at: string;
}

export interface Challenge {
  id: number;
  campaign_id: number;
  created_by_user_id: number;
  description: string;
  difficulty_modifier: number;
  is_group_challenge: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeWithStats extends Challenge {
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
}

export interface RollHistoryWithCharacter extends RollHistory {
  character_name: string;
}