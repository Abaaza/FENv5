import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  DATABASE_URL: z.string().optional(),
  CONVEX_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('16h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  V2_API_KEY: z.string().optional(),
  V1_API_KEY: z.string().optional(),
  MAX_FILE_SIZE: z.string().default('50MB'),
  UPLOAD_DIR: z.string().default('uploads'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z.string().transform(val => val === 'true').default('false'),
  COOKIE_HTTPONLY: z.string().transform(val => val === 'true').default('true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

export const env = envSchema.parse(process.env);

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
