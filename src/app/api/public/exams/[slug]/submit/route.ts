import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { assessAttempt, calculateRank } from '@/lib/exam-results';
import type { QuestionItem } from '@/types/paper';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const body = await req.json(); const { db } = await connectToDatabase();
  const exam = await db.collection('exams').findOne({ slug }); const attempt = await db.collection('exam_attempts').findOne({ id: body.attemptId, sessionToken: body.sessionToken, status: 'in_progress' });
  if (!exam || !attempt || String(attempt.examId) !== String(exam.id)) return NextResponse.json({ success: false, error: 'Invalid or already submitted exam session.' }, { status: 401 });
  const answers = typeof body.answers === 'object' && body.answers && !Array.isArray(body.answers) ? body.answers as Record<string, string> : {};
  const { result, responseReview } = assessAttempt((exam.questions || []) as QuestionItem[], answers);
  const submittedAt = new Date().toISOString();
  await db.collection('exam_attempts').updateOne({ _id: attempt._id }, { $set: { answers, violations: body.violations || attempt.violations, submittedAt, updatedAt: submittedAt, status: body.autoSubmitted ? 'auto_submitted' : 'submitted', result } });
  const submittedAttempts = await db.collection('exam_attempts').find(
    { examId: String(exam.id), status: { $in: ['submitted', 'auto_submitted'] } },
    { projection: { 'result.score': 1 } },
  ).toArray();
  const ranking = calculateRank(result.score, submittedAttempts.map(item => Number(item.result?.score) || 0));
  // Result review is part of the student delivery contract. This remains true
  // for historic exams that were created before the result-visibility switch
  // existed (and may therefore have this field set to false or absent).
  return NextResponse.json({ success: true, result: { ...result, ...ranking, responseReview }, attempt: { student: attempt.student, startedAt: attempt.startedAt, submittedAt, status: body.autoSubmitted ? 'auto_submitted' : 'submitted' } });
}
