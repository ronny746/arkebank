import { getTenantForHost } from '@/lib/tenant';

export const PRODUCTION_DOMAIN = 'https://bank.arkescholar.com';

/**
 * Student links always use an opaque token. A separately branded, neutral
 * public exam host can be supplied with NEXT_PUBLIC_EXAM_ORIGIN once its DNS
 * points at this deployment; authoring and public delivery still share MongoDB.
 */
export function getPublicExamUrl(slugOrPath: string, requestHost?: string | null): string {
  if (!slugOrPath) return '';
  const cleanSlug = slugOrPath.replace(/^.*\/e\//, '').replace(/^\//, '');
  // Client-side copy/open actions do not have a Request object. Resolve from
  // the browser host there, and from the request host in route handlers.
  const browserHost = typeof window !== 'undefined' ? window.location.hostname : null;
  const tenant = getTenantForHost(requestHost || browserHost);
  const envUrl = tenant.id === 'prepzo'
    ? process.env.NEXT_PUBLIC_PREPZO_EXAM_ORIGIN
    : process.env.NEXT_PUBLIC_ARKE_EXAM_ORIGIN || process.env.NEXT_PUBLIC_EXAM_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return `${envUrl.replace(/\/$/, '')}/e/${cleanSlug}`;
  }

  // Do not reflect an untrusted Host header in a link sent to faculty.
  const canonicalHost = tenant.id === 'prepzo' ? 'bank.theprepzo.com' : 'bank.arkescholar.com';
  return `https://${canonicalHost}/e/${cleanSlug}`;
}
