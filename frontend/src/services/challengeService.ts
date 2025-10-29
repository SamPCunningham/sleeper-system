import api from './api';
import type { Challenge, ChallengeWithStats } from '../types';

export const challengeService = {
  create: async (data: {
    campaign_id: number;
    description: string;
    difficulty_modifier: number;
    is_group_challenge: boolean;
  }): Promise<Challenge> => {
    const response = await api.post<Challenge>('/challenges', data);
    return response.data;
  },

  listByCampaign: async (campaignId: number): Promise<ChallengeWithStats[]> => {
    const response = await api.get<ChallengeWithStats[]>(`/campaigns/${campaignId}/challenges`);
    return response.data;
  },

  complete: async (challengeId: number): Promise<Challenge> => {
    const response = await api.post<Challenge>(`/challenges/${challengeId}/complete`);
    return response.data;
  },
};