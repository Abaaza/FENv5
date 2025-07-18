export interface UserPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
