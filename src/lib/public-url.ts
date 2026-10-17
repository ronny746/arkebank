export const PRODUCTION_DOMAIN = 'https://bank.arkescholar.com';

/**
 * Student links always use the public assessment domain. The authoring app and
 * public student app share MongoDB, so an exam created from localhost is still
 * immediately available at this URL.
 */
export function getPublicExamUrl(slugOrPath: string): string {
  if (!slugOrPath) return '';
  const cleanSlug = slugOrPath.replace(/^.*\/e\//, '').replace(/^\//, '');
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return `${envUrl.replace(/\/$/, '')}/e/${cleanSlug}`;
  }

  return `${PRODUCTION_DOMAIN}/e/${cleanSlug}`;
}
