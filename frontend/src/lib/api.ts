import axios from 'axios';
import { retryWithBackoff } from '../utils/retryWithBackoff';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for login and refresh endpoints
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await retryWithBackoff(
          () => api.post('/auth/refresh'),
          {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (error) => {
              // Don't retry 401 on refresh - token is invalid
              return error?.response?.status !== 401 &&
                     (error?.code === 'ERR_NETWORK' || 
                      error?.code === 'ERR_CONNECTION_REFUSED');
            }
          }
        );
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        onRefreshed(accessToken);
        isRefreshing = false;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        // Only redirect to login if we're not already there and it's not a network error
        if (window.location.pathname !== '/login' && 
            refreshError?.code !== 'ERR_NETWORK' && 
            refreshError?.code !== 'ERR_CONNECTION_REFUSED') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);