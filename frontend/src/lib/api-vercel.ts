// API client for Vercel deployment
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth.store';

// Use relative URLs for Vercel deployment
const API_BASE_URL = '/api';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = useAuthStore.getState().refreshToken;
            if (refreshToken) {
              const response = await this.instance.post('/auth/refresh', {
                refreshToken,
              });

              const { accessToken } = response.data.data;
              useAuthStore.getState().setTokens(accessToken, refreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.instance.post('/auth/login', { email, password });
    return response.data;
  }

  async register(data: any) {
    const response = await this.instance.post('/auth/register', data);
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.instance.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  // Price matching endpoints
  async uploadBOQ(formData: FormData) {
    const response = await this.instance.post('/price-matching/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getJobStatus(jobId: string) {
    const response = await this.instance.get(`/price-matching/status/${jobId}`);
    return response.data;
  }

  async downloadResults(jobId: string) {
    const response = await this.instance.get(`/price-matching/download/${jobId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Price list endpoints
  async getPriceItems(params?: any) {
    const response = await this.instance.get('/price-list', { params });
    return response.data;
  }

  async createPriceItem(data: any) {
    const response = await this.instance.post('/price-list', data);
    return response.data;
  }

  async updatePriceItem(id: string, data: any) {
    const response = await this.instance.put(`/price-list/${id}`, data);
    return response.data;
  }

  async deletePriceItem(id: string) {
    const response = await this.instance.delete(`/price-list/${id}`);
    return response.data;
  }

  async importPriceList(formData: FormData) {
    const response = await this.instance.post('/price-list/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Project endpoints
  async getProjects(params?: any) {
    const response = await this.instance.get('/projects', { params });
    return response.data;
  }

  async createProject(data: any) {
    const response = await this.instance.post('/projects', data);
    return response.data;
  }

  async updateProject(id: string, data: any) {
    const response = await this.instance.put(`/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: string) {
    const response = await this.instance.delete(`/projects/${id}`);
    return response.data;
  }

  // User endpoints
  async getCurrentUser() {
    const response = await this.instance.get('/users/me');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.instance.put('/users/me', data);
    return response.data;
  }

  async changePassword(data: any) {
    const response = await this.instance.post('/users/me/change-password', data);
    return response.data;
  }

  // Admin endpoints
  async getUsers(params?: any) {
    const response = await this.instance.get('/admin/users', { params });
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.instance.put(`/admin/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.instance.delete(`/admin/users/${id}`);
    return response.data;
  }

  async getActivityLogs(params?: any) {
    const response = await this.instance.get('/admin/activity-logs', { params });
    return response.data;
  }

  async getSettings() {
    const response = await this.instance.get('/admin/settings');
    return response.data;
  }

  async updateSettings(data: any) {
    const response = await this.instance.put('/admin/settings', data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
