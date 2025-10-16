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
  notes: string | null;
  created_at: string;
}