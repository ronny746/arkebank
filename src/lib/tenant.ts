export type TenantId = 'arke' | 'prepzo';

export type TenantBrand = {
  id: TenantId;
  hostnames: string[];
  name: string;
  portalName: string;
  subtitle: string;
  logoSrc: string;
  logoWidth: number;
  logoHeight: number;
  logoIncludesWordmark?: boolean;
  paperInstituteName: string;
  paperFooterText: string;
  /** Question datasets this portal must never show (bank, preview, generation). */
  hiddenDatasets: string[];
};

const brands: Record<TenantId, TenantBrand> = {
  arke: {
    id: 'arke',
    hostnames: ['bank.arkescholar.com', 'arkescholar.com', 'www.arkescholar.com'],
    name: 'ARKE SCHOLARS',
    portalName: 'ARKE SCHOLARS',
    subtitle: 'Question Bank & Assessment Intelligence',
    logoSrc: '/logo.png',
    logoWidth: 65,
    logoHeight: 50,
    paperInstituteName: 'ARKE SCHOLARS ACADEMY',
    paperFooterText: 'ARKE SCHOLARS ASSESSMENT SYSTEM',
    // Business rule: TestlyPro content is licensed for Prepzo only.
    hiddenDatasets: ['testlypro'],
  },
  prepzo: {
    id: 'prepzo',
    hostnames: ['bank.theprepzo.com', 'theprepzo.com', 'www.theprepzo.com'],
    name: 'Prepzo',
    portalName: 'PREPZO',
    subtitle: 'Smart prep, learn anytime anywhere',
    logoSrc: '/prepzo-logo-horizontal.png',
    logoWidth: 142,
    logoHeight: 43,
    logoIncludesWordmark: true,
    paperInstituteName: 'Prepzo',
    paperFooterText: 'PREPZO ASSESSMENT SYSTEM',
    hiddenDatasets: [],
  },
};

/**
 * Applies the tenant's dataset visibility to a questions query. Always derive
 * `tenantId` from the verified token, never from the request body, so a client
 * cannot ask for a dataset its portal must not show.
 */
export function applyTenantDatasetScope<T extends Record<string, unknown>>(
  query: T,
  tenantId: TenantId,
  requestedDataset?: unknown,
): T {
  const hidden = brands[tenantId].hiddenDatasets;
  const requested = typeof requestedDataset === 'string' && requestedDataset && requestedDataset !== 'all'
    ? requestedDataset
    : null;
  const scoped: Record<string, unknown> = query;
  if (requested) {
    // An explicitly requested hidden dataset matches nothing rather than erroring,
    // so stale browser state degrades to an empty result.
    scoped.dataset = hidden.includes(requested) ? { $in: [] } : requested;
  } else if (hidden.length) {
    scoped.dataset = { $nin: hidden };
  }
  return query;
}

export function isDatasetHiddenForTenant(tenantId: TenantId, dataset: unknown): boolean {
  return typeof dataset === 'string' && brands[tenantId].hiddenDatasets.includes(dataset);
}

export function tenantHiddenDatasets(tenantId: TenantId): string[] {
  return brands[tenantId].hiddenDatasets;
}

export function getTenantForHost(host: string | null | undefined): TenantBrand {
  const hostname = String(host || '').toLowerCase().split(':')[0];
  return brands.prepzo.hostnames.includes(hostname) ? brands.prepzo : brands.arke;
}

export function getTenantForRequest(request: Request): TenantBrand {
  return getTenantForHost(request.headers.get('x-forwarded-host') || request.headers.get('host'));
}

export function tenantDocumentQuery(tenantId: TenantId): Record<string, unknown> {
  // Existing documents were created before tenancy and therefore belong to ARKE.
  return tenantId === 'arke'
    ? { $or: [{ tenantId: 'arke' }, { tenantId: { $exists: false } }] }
    : { tenantId };
}

function emailsFromEnv(variable: string, fallback: string[]): string[] {
  const raw = process.env[variable];
  if (!raw) return fallback;
  return raw.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

export function tenantAdminEmails(tenantId: TenantId): string[] {
  if (tenantId === 'prepzo') return emailsFromEnv('PREPZO_ADMIN_EMAILS', []);
  return emailsFromEnv('ARKE_ADMIN_EMAILS', ['admin@arkescholar.com', 'rohit@arkescholar.com']);
}
