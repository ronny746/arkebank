import PublicExamClient from './public-exam-client';
import { headers } from 'next/headers';
import { getTenantForHost } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const requestHeaders = await headers();
  const brand = getTenantForHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  return <PublicExamClient slug={slug} brand={brand} />;
}
