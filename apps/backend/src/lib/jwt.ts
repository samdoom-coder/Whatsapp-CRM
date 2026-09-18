import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const secret = new TextEncoder().encode(config.authSecret);
const ALG = 'HS256';

export interface SessionPayload {
  sub: string; // user id
  email: string;
}

export const signSession = (payload: SessionPayload, expiresIn = '30d'): Promise<string> =>
  new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

export const verifySession = async (token: string): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return { sub: payload.sub, email: (payload.email as string) ?? '' };
  } catch {
    return null;
  }
};