import { apiClient } from './client';
import { UserDto, CreateUserRequest, UpdateUserRequest, PagedRequest, PagedResult } from '../types/user';

export const userApi = {
  getPaged: async (params: PagedRequest): Promise<PagedResult<UserDto>> => {
    const response = await apiClient.get('/users', { params });
    return response.data.data;
  },

  getById: async (id: number): Promise<UserDto> => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data.data;
  },

  create: async (data: CreateUserRequest): Promise<UserDto> => {
    const response = await apiClient.post('/users', data);
    return response.data.data;
  },

  update: async (id: number, data: UpdateUserRequest): Promise<UserDto> => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<string> => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data.data;
  },
};
