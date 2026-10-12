// Pure policy helpers, kept separate so they can be exercised without a Next server.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host') ?? url.host;
    return new URL(origin).origin === origin && origin === `${url.protocol}//${host}`;
  } catch { return false; }
}
const id = /^[a-zA-Z0-9_-]{1,128}$/;
// Mutations are an explicit allowlist; Nest remains authoritative for authorization and transition guards.
export function consoleMutationPath(parts: string[], method: 'POST' | 'PATCH'): string | null {
  if (method === 'POST' && parts.length === 1 && ['showings', 'follow-up-tasks'].includes(parts[0])) return parts[0];
  if (method === 'POST' && parts.length === 3 && parts[0] === 'cases' && id.test(parts[1]) && parts[2] === 'transitions') return parts.join('/');
  if (method === 'POST' && parts.length === 3 && parts[0] === 'follow-up-tasks' && id.test(parts[1]) && parts[2] === 'complete') return parts.join('/');
  if (method === 'PATCH' && parts.length === 4 && parts[0] === 'showings' && id.test(parts[1]) && parts[2] === 'participants' && id.test(parts[3])) return parts.join('/');
  return null;
}
