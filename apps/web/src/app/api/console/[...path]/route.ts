import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, internalApiUrl } from '@/lib/session';
import { consoleMutationPath, sameOrigin } from '@/lib/session-policy';

export const dynamic = 'force-dynamic';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const error = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers });

async function mutate(request: NextRequest, params: Promise<{ path: string[] }>, method: 'POST' | 'PATCH') {
  if (!sameOrigin(request)) return error(403, 'Forbidden');
  const path = consoleMutationPath((await params).path, method);
  if (!path) return error(404, 'Not found');
  if (request.nextUrl.search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || Number(request.headers.get('content-length') || 0) > 4096) return error(400, 'Expected JSON under 4 KB');
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return error(401, 'Unauthorized');
  let body: string;
  try {
    body = await request.text();
    const parsed: unknown = JSON.parse(body);
    if (body.length > 4096 || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return error(400, 'Invalid JSON');
  } catch { return error(400, 'Invalid JSON'); }
  try {
    const upstream = await fetch(internalApiUrl(path), {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body, cache: 'no-store', redirect: 'error',
    });
    if (!upstream.headers.get('content-type')?.includes('application/json')) throw new Error('Non-JSON response');
    // Do not forward upstream cookies, CORS or caching headers.
    return new NextResponse(await upstream.text(), { status: upstream.status, headers });
  } catch { return error(502, 'Service unavailable'); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) { return mutate(request, params, 'POST'); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) { return mutate(request, params, 'PATCH'); }
