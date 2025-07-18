export class DebugLogger {
  private static instance: DebugLogger;
  private enabled: boolean = true;

  private constructor() {
    this.enabled = process.env.DEBUG_MATCHING === 'true' || process.env.NODE_ENV === 'development';
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(context: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${context}] ${message}`;
    
    console.log('\x1b[36m%s\x1b[0m', logMessage);
    if (data) {
      console.log('\x1b[90m%s\x1b[0m', JSON.stringify(data, null, 2));
    }
  }

  error(context: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${context}] ERROR: ${message}`;
    
    console.error('\x1b[31m%s\x1b[0m', logMessage);
    if (error) {
      console.error('\x1b[31m%s\x1b[0m', error.stack || error);
    }
  }

  success(context: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${context}] âœ“ ${message}`;
    
    console.log('\x1b[32m%s\x1b[0m', logMessage);
    if (data) {
      console.log('\x1b[90m%s\x1b[0m', JSON.stringify(data, null, 2));
    }
  }

  warning(context: string, message: string, data?: any) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${context}] âš  ${message}`;
    
    console.log('\x1b[33m%s\x1b[0m', logMessage);
    if (data) {
      console.log('\x1b[90m%s\x1b[0m', JSON.stringify(data, null, 2));
    }
  }

  startTimer(context: string, operation: string): () => void {
    const startTime = Date.now();
    this.log(context, `Starting ${operation}...`);
    
    return () => {
      const duration = Date.now() - startTime;
      this.success(context, `${operation} completed in ${duration}ms`);
    };
  }
}

export const debugLog = DebugLogger.getInstance();
