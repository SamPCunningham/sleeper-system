import api from './api';
import type { Campaign } from '../types';

export const campaignService = {
  list: async (): Promise<Campaign[]> => {
    const response = await api.get<Campaign[]>('/campaigns');
    return response.data;
  },

  get: async (id: number): Promise<Campaign> => {
    const response = await api.get<Campaign>(`/campaigns/${id}`);
    return response.data;
  },

  create: async (name: string): Promise<Campaign> => {
    const response = await api.post<Campaign>('/campaigns', { name });
    return response.data;
  },

  incrementDay: async (id: number): Promise<Campaign> => {
    const response = await api.post<Campaign>(`/campaigns/${id}/increment-day`);
    return response.data;
  },
};