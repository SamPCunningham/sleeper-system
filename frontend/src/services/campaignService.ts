import api from './api';
import type { Campaign, User, CampaignMember } from '../types';

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

  listUsers: async (campaignId: number): Promise<User[]> => {
    const response = await api.get<User[]>(`/campaigns/${campaignId}/users`);
    return response.data;
  },

  listMembers: async (campaignId: number): Promise<CampaignMember[]> => {
    const response = await api.get<CampaignMember[]>(`/campaigns/${campaignId}/members`);
    return response.data;
  },

  addMember: async (campaignId: number, userId: number): Promise<CampaignMember> => {
    const response = await api.post<CampaignMember>(`/campaigns/${campaignId}/members`, {
      user_id: userId,
    });
    return response.data;
  },

  removeMember: async (campaignId: number, userId: number): Promise<void> => {
    await api.delete(`campaigns/${campaignId}/members/${userId}`);
  }
};