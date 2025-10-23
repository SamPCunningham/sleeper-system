import api from './api';
import type { Character } from '../types';

export const characterService = {
    create: async (data: {
        campaign_id: number;
        name: string;
        skill_name?: string;
        skill_modifier: number;
        weakness_name?: string;
        weakness_modifier: number;
    assigned_user_id?: number;
    }): Promise<Character> => {
        const response = await api.post<Character>('/characters', data);
        return response.data;
    },

    listByCampaign: async (campaignId: number): Promise<Character[]> => {
        const response = await api.get<Character[]>(`/campaigns/${campaignId}/characters`);
        return response.data;
    },

    get: async (id: number): Promise<Character> => {
        const response = await api.get<Character>(`/characters/${id}`);
        return response.data;
    },

    update: async (id: number, data: {
        name: string;
        skill_name?: string;
        skill_modifier: number;
        weakness_name?: string;
        weakness_modifier: number;
    }): Promise<Character> => {
        const response = await api.put<Character>(`/characters/${id}`, data);
        return response.data;
    },
};