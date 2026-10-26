import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getTenantForRequest, tenantDocumentQuery } from '@/lib/tenant';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const tenant = getTenantForRequest(req);
  const { db } = await connectToDatabase();
  const exam = await db.collection('exams').findOne({ slug, ...tenantDocumentQuery(tenant.id) }, { projection: { id: 1 } });

  if (!exam || !body?.attemptId || !body?.sessionToken) {
    return NextResponse.json({ success: false, error: 'Invalid exam session.' }, { status: 401 });
  }

  const attempt = await db.collection('exam_attempts').findOne({
    id: body.attemptId,
    sessionToken: body.sessionToken,
    examId: exam.id,
    status: 'in_progress',
    ...tenantDocumentQuery(tenant.id),
  });
  if (!attempt) return NextResponse.json({ success: false, error: 'Exam session is no longer active.' }, { status: 409 });

  const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : attempt.answers || {};
  const violations = body.violations && typeof body.violations === 'object' ? {
    tabSwitches: Math.max(0, Number(body.violations.tabSwitches) || 0),
    fullScreenExits: Math.max(0, Number(body.violations.fullScreenExits) || 0),
  } : attempt.violations || { tabSwitches: 0, fullScreenExits: 0 };

  await db.collection('exam_attempts').updateOne(
    { _id: attempt._id },
    { $set: { answers, violations, currentQuestion: Math.max(0, Number(body.currentQuestion) || 0), updatedAt: new Date().toISOString() } },
  );
  return NextResponse.json({ success: true });
}
