/**
 * RevenueCat → Supabase webhook. Mirrors the `plus` entitlement into `public.subscriptions`
 * (see supabase/migrations/20261111000300_billing.sql).
 *
 * Deploy with JWT verification OFF (RevenueCat cannot send a Supabase JWT):
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 * Secrets:
 *   REVENUECAT_WEBHOOK_AUTH  – the exact Authorization header value set in the RevenueCat dashboard
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY – provided by the platform
 *
 * Logs contain event ids/types only — never user ids or payloads.
 */
// eslint-disable-next-line import/no-unresolved -- `npm:` specifiers are resolved by the Deno edge runtime
import { createClient } from 'npm:@supabase/supabase-js@2';

import { isAuthorized, MAX_BODY_BYTES, parseWebhookBody, planEvent } from './logic.ts';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret) {
    console.error('revenuecat-webhook: REVENUECAT_WEBHOOK_AUTH is not configured');
    return json(500, { error: 'not_configured' });
  }
  if (!isAuthorized(req.headers.get('authorization'), secret)) return json(401, { error: 'unauthorized' });

  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' });

  const parsed = parseWebhookBody(await req.text());
  if (!parsed.ok) return json(400, { error: parsed.error });

  const plan = planEvent(parsed.event);
  if (plan.kind === 'ignore') return json(200, { result: 'ignored', reason: plan.reason });

  const db = adminClient();
  if (!db) {
    console.error('revenuecat-webhook: Supabase service credentials missing');
    return json(500, { error: 'not_configured' });
  }

  const { data, error } =
    plan.kind === 'apply'
      ? await db.rpc('billing_apply_event', {
          p_event_id: plan.eventId,
          p_event_type: plan.eventType,
          p_event_at: plan.eventAt,
          p_user_id: plan.userId,
          p_product_id: plan.productId,
          p_store: plan.store,
          p_environment: plan.environment,
          p_period_type: plan.periodType,
          p_expires_at: plan.expiresAt,
        })
      : await db.rpc('billing_transfer', {
          p_event_id: plan.eventId,
          p_event_at: plan.eventAt,
          p_from: plan.from,
          p_to: plan.to,
        });

  if (error) {
    // Non-200 makes RevenueCat retry (up to 5 times over ~80 minutes); writes are idempotent.
    console.error(`revenuecat-webhook: failed to store event ${parsed.event.id} (${parsed.event.type}): ${error.message}`);
    return json(500, { error: 'storage_failed' });
  }

  return json(200, { result: typeof data === 'string' ? data : 'applied' });
});
