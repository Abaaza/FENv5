import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

// Create axios instance with timeout and retry logic
export function createHttpClient(options: {
  timeout?: number;
  maxRetries?: number;
  keepAlive?: boolean;
} = {}): AxiosInstance {
  const {
    timeout = 10000, // 10 seconds default
    maxRetries = 3,
    keepAlive = true
  } = options;

  // Create custom agents with keep-alive
  const httpAgent = new http.Agent({
    keepAlive,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: timeout,
  });

  const httpsAgent = new https.Agent({
    keepAlive,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: timeout,
  });

  const client = axios.create({
    timeout,
    httpAgent,
    httpsAgent,
    // Disable proxy if it might be causing issues
    proxy: false,
    // Add headers that might help with connection
    headers: {
      'Connection': keepAlive ? 'keep-alive' : 'close',
      'Accept-Encoding': 'gzip, deflate',
    }
  });

  // Add retry interceptor
  client.interceptors.response.use(
    response => response,
    async error => {
      const config = error.config;
      
      // Check if we should retry
      if (!config || !config.retry) {
        config.retry = 0;
      }
      
      if (config.retry >= maxRetries) {
        return Promise.reject(error);
      }
      
      // Retry on network errors or 5xx errors
      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        (error.response && error.response.status >= 500)
      ) {
        config.retry += 1;
        
        // Exponential backoff
        const delay = Math.pow(2, config.retry) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return client(config);
      }
      
      return Promise.reject(error);
    }
  );

  return client;
}

// Export a default client
export const httpClient = createHttpClient();
