// Production-safe logger wrapper
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error('[ERROR]', ...args);
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  }
};

// Replace console.log globally in production
if (!isDevelopment) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}
