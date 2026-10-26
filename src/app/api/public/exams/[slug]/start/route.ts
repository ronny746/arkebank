import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { assessAttempt, calculateRank } from '@/lib/exam-results';
import type { QuestionItem } from '@/types/paper';
import { getTenantForRequest, tenantDocumentQuery } from '@/lib/tenant';

const normaliseEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalisePhone = (value: unknown) => String(value || '').replace(/\D/g, '');
const normaliseName = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const body = await req.json();
  const tenant = getTenantForRequest(req);
  const name = String(body?.name || '').trim();
  const email = normaliseEmail(body?.email);
  const phone = String(body?.phone || '').trim();
  const phoneKey = normalisePhone(phone);
  const nameKey = normaliseName(name);
  if (!name || !phoneKey) return NextResponse.json({ success: false, error: 'Full name and phone number are required.' }, { status: 400 });
  const { db } = await connectToDatabase(); const exam = await db.collection('exams').findOne({ slug, status: 'published', ...tenantDocumentQuery(tenant.id) });
  if (!exam) return NextResponse.json({ success: false, error: 'This exam is unavailable.' }, { status: 403 });

  // A submitted test must lead back to its result, not create a duplicate
  // attempt. The public exam flow deliberately does not require email, so
  // match the same normalised full name and mobile number instead.
  const completedAttempt = await db.collection('exam_attempts').findOne({
    $and: [
      tenantDocumentQuery(tenant.id),
      { examId: String(exam.id), status: { $in: ['submitted', 'auto_submitted'] } },
      { $or: [
        { 'student.nameKey': nameKey, 'student.phoneKey': phoneKey },
        // Supports attempts created before nameKey was introduced.
        { 'student.name': name, 'student.phone': phone },
      ] },
    ],
  });
  if (completedAttempt) {
    const assessment = assessAttempt((exam.questions || []) as QuestionItem[], completedAttempt.answers || {});
    const submittedAttempts = await db.collection('exam_attempts').find(
      { examId: String(exam.id), status: { $in: ['submitted', 'auto_submitted'] }, ...tenantDocumentQuery(tenant.id) },
      { projection: { 'result.score': 1 } },
    ).toArray();
    const ranking = calculateRank(assessment.result.score, submittedAttempts.map(item => Number(item.result?.score) || 0));
    return NextResponse.json({
      success: true,
      alreadySubmitted: true,
      result: { ...assessment.result, ...ranking, responseReview: assessment.responseReview },
      attempt: { student: completedAttempt.student, startedAt: completedAttempt.startedAt, submittedAt: completedAttempt.submittedAt, status: completedAttempt.status },
      message: 'Your submitted attempt was found. Here is your result analysis.',
    });
  }

  if (Date.now() < new Date(String(exam.startsAt)).getTime() || Date.now() > new Date(String(exam.endsAt)).getTime()) {
    return NextResponse.json({ success: false, error: 'This exam is unavailable for a new attempt.' }, { status: 403 });
  }

  const startedAt = new Date().toISOString();
  const attempt = { id: randomUUID(), examId: String(exam.id), tenantId: tenant.id, sessionToken: randomBytes(24).toString('base64url'), student: { name, nameKey, email, phone, phoneKey }, answers: {}, violations: { tabSwitches: 0, fullScreenExits: 0 }, currentQuestion: 0, startedAt, updatedAt: startedAt, status: 'in_progress' };
  await db.collection('exam_attempts').insertOne(attempt); return NextResponse.json({ success: true, attemptId: attempt.id, sessionToken: attempt.sessionToken, durationMinutes: exam.durationMinutes });
}
