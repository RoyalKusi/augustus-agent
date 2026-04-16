import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface JwtPayload {
  businessId: string;
  email: string;
  name?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & jwt.JwtPayload;
    return { businessId: decoded.businessId, email: decoded.email };
  } catch {
    return null;
  }
}
