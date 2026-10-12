import { NextRequest, NextResponse } from 'next/server';
import { CHALLENGE_COOKIE, clearSession, internalApiUrl, setChallenge, setSession } from '@/lib/session';
import { sameOrigin } from '@/lib/session-policy';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });
type Action = 'login' | 'mfa/verify' | 'mfa/bootstrap' | 'mfa/bootstrap/confirm' | 'logout';

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string[] }> }) {
  if (!sameOrigin(request)) return reply({ error: 'Forbidden' }, 403);
  const action = (await params).action.join('/') as Action;
  if (!['login', 'mfa/verify', 'mfa/bootstrap', 'mfa/bootstrap/confirm', 'logout'].includes(action)) return reply({ error: 'Not found' }, 404);
  if (action === 'logout') {
    const response = reply({ success: true });
    clearSession(response);
    return response;
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({ error: 'Expected JSON' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ error: 'Invalid request' }, 400);
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'Invalid request' }, 400);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    input = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: 'Invalid request' }, 400);
  }
  const challenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  let payload: object;
  if (action === 'login') {
    if (typeof input.email !== 'string' || !input.email || input.email.length > 254 ||
        typeof input.password !== 'string' || !input.password || input.password.length > 1024) return reply({ error: 'Invalid request' }, 400);
    payload = { email: input.email, password: input.password };
  } else if (action === 'mfa/bootstrap') {
    if (!challenge || Object.keys(input).length !== 0) return reply({ error: 'MFA challenge required' }, 401);
    payload = { mfaToken: challenge };
  } else {
    if (!challenge || typeof input.totpCode !== 'string' || !/^\d{6}$/.test(input.totpCode)) return reply({ error: 'Invalid MFA challenge or code' }, 400);
    payload = { mfaToken: challenge, totpCode: input.totpCode };
  }
  try {
    const upstream = await fetch(internalApiUrl(`auth/${action}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': request.headers.get('user-agent') ?? '' },
      body: JSON.stringify(payload), cache: 'no-store', redirect: 'error',
    });
    if (!upstream.ok) return reply({ error: upstream.status === 429 ? 'Too many attempts' : 'Authentication failed' }, upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 401);
    const data: unknown = await upstream.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid authentication response');
    const result = data as Record<string, unknown>;
    if (action === 'mfa/bootstrap') {
      if (typeof result.otpauthUrl !== 'string' || typeof result.secret !== 'string') throw new Error('Invalid enrollment response');
      return reply({ otpauthUrl: result.otpauthUrl, secret: result.secret });
    }
    if (action === 'login' && result.requiresMfa === true) {
      if (typeof result.mfaToken !== 'string' || !result.mfaToken) throw new Error('Missing MFA challenge');
      const response = reply({ requiresMfa: true, requiresEnrollment: result.requiresEnrollment === true });
      clearSession(response);
      setChallenge(response, result.mfaToken);
      return response;
    }
    if (typeof result.accessToken !== 'string' || !result.accessToken) throw new Error('Missing session token');
    const response = reply({ authenticated: true });
    setSession(response, result.accessToken);
    return response;
  } catch {
    return reply({ error: 'Authentication service unavailable' }, 502);
  }
}
