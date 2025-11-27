import api from './api';
import type { User, CreateUserRequest, UpdateUserRequest } from '../types';

export const adminService = {
  // List all users
  listUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/admin/users');
    return response.data;
  },

  // Get single user
  getUser: async (id: number): Promise<User> => {
    const response = await api.get<User>(`/admin/users/${id}`);
    return response.data;
  },

  // Create new user
  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await api.post<User>('/admin/users', data);
    return response.data;
  },

  // Update user
  updateUser: async (id: number, data: UpdateUserRequest): Promise<User> => {
    const response = await api.put<User>(`/admin/users/${id}`, data);
    return response.data;
  },

  // Set user password
  setPassword: async (id: number, password: string): Promise<void> => {
    await api.post(`/admin/users/${id}/set-password`, { password });
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },
};