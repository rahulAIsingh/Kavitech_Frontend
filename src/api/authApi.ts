import { apiClient } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, RefreshTokenRequest } from '../types/auth';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data.data;
  },

  register: async (data: RegisterRequest): Promise<string> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data.data;
  },

  refreshToken: async (data: RefreshTokenRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/refresh-token', data);
    return response.data.data;
  },

  logout: async (): Promise<string> => {
    const response = await apiClient.post('/auth/logout');
    return response.data.data;
  },
};
