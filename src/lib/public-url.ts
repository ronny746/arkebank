export const PRODUCTION_DOMAIN = 'https://bank.arkescholar.com';

/**
 * Student links always use an opaque token. A separately branded, neutral
 * public exam host can be supplied with NEXT_PUBLIC_EXAM_ORIGIN once its DNS
 * points at this deployment; authoring and public delivery still share MongoDB.
 */
export function getPublicExamUrl(slugOrPath: string): string {
  if (!slugOrPath) return '';
  const cleanSlug = slugOrPath.replace(/^.*\/e\//, '').replace(/^\//, '');
  const envUrl = process.env.NEXT_PUBLIC_EXAM_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return `${envUrl.replace(/\/$/, '')}/e/${cleanSlug}`;
  }

  return `${PRODUCTION_DOMAIN}/e/${cleanSlug}`;
}
