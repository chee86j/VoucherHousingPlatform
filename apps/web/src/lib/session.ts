import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'vhp_session';
export const CHALLENGE_COOKIE = 'vhp_mfa_challenge';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set(CHALLENGE_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
export function setChallenge(response: NextResponse, token: string) {
  response.cookies.set(CHALLENGE_COOKIE, token, { ...cookieOptions, maxAge: 300 });
}
export function setSession(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 900 });
  response.cookies.set(CHALLENGE_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
export async function getChallengeToken() {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value;
}

export function internalApiUrl(path: string): string {
  const base = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  // A deployment setting, never constructed from request headers or browser input.
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid API_INTERNAL_URL');
  }
  return `${url.href.replace(/\/$/, '')}/api/${path}`;
}

export async function getSessionUser(): Promise<{ id: string; email: string; name: string; role: string; orgId: string; mfaEnrolled: boolean } | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const response = await fetch(internalApiUrl('auth/me'), {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
