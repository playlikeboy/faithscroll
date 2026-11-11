/**
 * Shared HTTP + auth helpers for Faithscroll Edge Functions (Deno).
 * Dependency-free so it can be unit-tested from Jest as well.
 *
 * Privacy/security: never log tokens, emails or request bodies; error responses carry a stable
 * `code` and a generic message only.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** JSON error envelope: `{ error: { code, message } }`. Unknown errors become a generic 500. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  }
  return jsonResponse({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } }, 500);
}

/** Answers CORS preflight requests; returns null for every other request. */
export function handlePreflight(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

/** Extracts the bearer token from an Authorization header value. */
export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  // A JWT has three dot-separated base64url segments.
  return /^[\w-]+\.[\w-]+\.[\w-]*$/.test(match[1]) ? match[1] : null;
}

export interface VerifiedUser {
  id: string;
  email: string | null;
}

/** Minimal slice of a Supabase client used to verify a user JWT. */
export interface AuthVerifier {
  auth: {
    getUser(jwt: string): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string; status?: number } | null;
    }>;
  };
}

/**
 * Verifies the caller's access token with Supabase Auth (signature, expiry and that the user still
 * exists). Throws HttpError(401) when missing or invalid.
 */
export async function requireUser(request: Request, verifier: AuthVerifier): Promise<VerifiedUser> {
  const token = parseBearerToken(request.headers.get('Authorization'));
  if (!token) throw new HttpError(401, 'unauthorized', 'Please sign in again.');
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthorized', 'Please sign in again.');
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Reads a required secret; throws a 500 "not_configured" error (without naming values) when absent. */
export function requireSecret(read: (name: string) => string | undefined, name: string): string {
  const value = read(name)?.trim();
  if (!value) throw new HttpError(500, 'not_configured', 'This service is not configured.');
  return value;
}
