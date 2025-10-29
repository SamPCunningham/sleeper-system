import api from './api';
import type { DicePool, RollHistory } from '../types';

export const diceService = {
  rollNewPool: async (characterId: number): Promise<DicePool> => {
    const response = await api.post<DicePool>(`/characters/${characterId}/dice-pool`);
    return response.data;
  },

  manualRollPool: async (characterId: number, diceResults: number[]): Promise<DicePool> => {
    const response = await api.post<DicePool>(`/characters/${characterId}/dice-pool/manual`, {
      dice_results: diceResults,
    });
    return response.data;
  },

  getCurrentPool: async (characterId: number): Promise<DicePool> => {
    const response = await api.get<DicePool>(`/characters/${characterId}/dice-pool`);
    return response.data;
  },

  useDie: async (dieId: number) => {
    const response = await api.post(`/dice/${dieId}/use`);
    return response.data;
  },

  recordRoll: async (data: {
    character_id: number;
    pool_dice_id: number;
    d20_roll: number;
    action_type?: string;
    notes?: string;
    challenge_id?: number;
    skill_applied: boolean;
    other_modifiers: number;
  }): Promise<RollHistory> => {
    const response = await api.post<RollHistory>('/rolls', data);
    return response.data;
  },

  getRollHistory: async (characterId: number): Promise<RollHistory[]> => {
    const response = await api.get<RollHistory[]>(`/rolls?character_id=${characterId}`);
    return response.data;
  },
};