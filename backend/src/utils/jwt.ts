import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserPayload, TokenPair } from '../types/auth';

export function generateTokens(payload: UserPayload): TokenPair {
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
    algorithm: 'HS256',
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
    algorithm: 'HS256',
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): UserPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  }) as UserPayload;
}

export function verifyRefreshToken(token: string): UserPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  }) as UserPayload;
}
