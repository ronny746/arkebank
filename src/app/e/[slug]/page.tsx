import PublicExamClient from './public-exam-client';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicExamClient slug={slug} />;
}
