import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Refresh token every 10 minutes (before the 15-minute expiry)
    const refreshToken = async () => {
      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        console.log('[Token Refresh] Successfully refreshed token');
      } catch (error) {
        console.error('[Token Refresh] Failed to refresh token:', error);
      }
    };

    // Initial refresh after 10 minutes
    const timeoutId = setTimeout(() => {
      refreshToken();
      
      // Then refresh every 10 minutes
      intervalRef.current = setInterval(refreshToken, 10 * 60 * 1000);
    }, 10 * 60 * 1000);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);
}