import Portal from '@/app/page';

export default async function PaperGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string }>;
}) {
  const { paper } = await searchParams;
  return <Portal initialTab="generator" paperId={typeof paper === 'string' ? paper : undefined} />;
}
