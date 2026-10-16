import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const body = await req.json(); const { db } = await connectToDatabase();
  const exam = await db.collection('exams').findOne({ slug }); const attempt = await db.collection('exam_attempts').findOne({ id: body.attemptId, sessionToken: body.sessionToken, status: 'in_progress' });
  if (!exam || !attempt || String(attempt.examId) !== String(exam.id)) return NextResponse.json({ success: false, error: 'Invalid or already submitted exam session.' }, { status: 401 });
  const answers = typeof body.answers === 'object' && body.answers ? body.answers : {}; let score = 0; let correct = 0; let wrong = 0;
  for (const q of exam.questions as Array<Record<string, unknown>>) { const selected = String(answers[String(q._id)] || answers[String(q.id)] || '').toLowerCase(); if (!selected) continue; if (selected === String(q.correct_option || q.correct_answer || '').toLowerCase()) { correct++; score += Number(q.marks) || 4; } else { wrong++; score -= Number(q.negative_marks) || 1; } }
  const total = (exam.questions as unknown[]).length; const result = { score, totalCorrect: correct, totalWrong: wrong, totalUnattempted: total - correct - wrong };
  const submittedAt = new Date().toISOString();
  await db.collection('exam_attempts').updateOne({ _id: attempt._id }, { $set: { answers, violations: body.violations || attempt.violations, submittedAt, updatedAt: submittedAt, status: body.autoSubmitted ? 'auto_submitted' : 'submitted', result } });
  return NextResponse.json({ success: true, result: exam.showResultsAfterSubmit ? result : undefined });
}
