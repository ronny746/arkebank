import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { cached } from '@/lib/cache';
import { getTenantForRequest, tenantDocumentQuery } from '@/lib/tenant';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = getTenantForRequest(req);

  try {
    const exam = await cached(`exam:public:${tenant.id}:${slug}`, 60, async () => {
      const { db } = await connectToDatabase();
      return await db.collection('exams').findOne(
        { slug, ...tenantDocumentQuery(tenant.id) },
        { projection: { 'questions.correct_option': 0, 'questions.correct_answer': 0, 'questions.solution': 0 } }
      );
    });

    if (!exam || exam.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Exam not found or unavailable.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const now = Date.now();
    const isAvailable = now >= new Date(String(exam.startsAt)).getTime() && now <= new Date(String(exam.endsAt)).getTime();

    return NextResponse.json({ success: true, exam: { ...exam, isAvailable } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('Public exam fetch error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load exam.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
