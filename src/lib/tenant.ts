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
  },
};

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
