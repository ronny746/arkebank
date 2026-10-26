import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTenantForHost } from '@/lib/tenant';
import 'katex/dist/katex.min.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const tenant = getTenantForHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  const tenantIcon = tenant.logoSrc;
  return {
    title: `${tenant.portalName} — ${tenant.subtitle}`,
    description: `${tenant.name} assessment workspace with verified questions, exam delivery, and student results.`,
    // Keep browser chrome on-brand as well. Static <link rel="icon"> tags
    // would override this host-aware value.
    icons: {
      icon: [{ url: tenantIcon, type: 'image/png' }],
      shortcut: tenantIcon,
      apple: tenantIcon,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
