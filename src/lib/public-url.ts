export const PRODUCTION_DOMAIN = 'https://bank.arkescholar.com';

/**
 * Returns the public URL for sharing with students.
 * Always prefers the live production domain (https://bank.arkescholar.com)
 * so that even when creating exams locally on localhost:3000, links shared
 * with students always resolve on the live production server.
 */
export function getPublicExamUrl(slugOrPath: string): string {
  if (!slugOrPath) return '';
  const cleanSlug = slugOrPath.replace(/^.*\/e\//, '').replace(/^\//, '');

  // 1. If configured in environment variable and not localhost
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return `${envUrl.replace(/\/$/, '')}/e/${cleanSlug}`;
  }

  // 2. If running in browser on a real remote domain (e.g. cloudflare, custom domain)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.') && !hostname.startsWith('10.')) {
      return `${window.location.origin}/e/${cleanSlug}`;
    }
  }

  // 3. Default to live production domain
  return `${PRODUCTION_DOMAIN}/e/${cleanSlug}`;
}

/**
 * Returns the local URL if running on localhost, for quick testing
 */
export function getLocalExamUrl(slugOrPath: string): string | null {
  if (!slugOrPath) return null;
  const cleanSlug = slugOrPath.replace(/^.*\/e\//, '').replace(/^\//, '');
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.origin}/e/${cleanSlug}`;
    }
  }
  return null;
}
