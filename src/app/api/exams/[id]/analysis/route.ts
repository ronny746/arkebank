import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { assessAttempt, calculateRank } from '@/lib/exam-results';
import type { QuestionItem } from '@/types/paper';

type AttemptRecord = { status?: string; result?: { score?: number }; answers?: Record<string, string>; violations?: { tabSwitches?: number; fullScreenExits?: number }; [key: string]: unknown };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!extractAndVerifyToken(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { db } = await connectToDatabase();
  const [rawExam, attempts] = await Promise.all([
    db.collection('exams').findOne({ id }),
    db.collection('exam_attempts').find({ examId: id }, { projection: { sessionToken: 0 } }).sort({ startedAt: -1 }).toArray(),
  ]);
  if (!rawExam) return NextResponse.json({ success: false, error: 'Exam not found.' }, { status: 404 });

  const questions = (Array.isArray(rawExam.questions) ? rawExam.questions : []) as QuestionItem[];
  const submittedBase = attempts.filter(attempt => attempt.status === 'submitted' || attempt.status === 'auto_submitted');
  const scores = submittedBase.map(attempt => Number((attempt as unknown as AttemptRecord).result?.score) || 0);
  const attemptsWithReview = attempts.map(attempt => {
    const typed = attempt as unknown as AttemptRecord;
    const assessment = assessAttempt(questions, typed.answers || {});
    const isSubmitted = typed.status === 'submitted' || typed.status === 'auto_submitted';
    return {
      ...typed,
      result: isSubmitted ? { ...assessment.result, ...calculateRank(assessment.result.score, scores) } : typed.result,
      responseReview: assessment.responseReview,
    };
  });
  const typedAttempts = attemptsWithReview as Array<AttemptRecord & { responseReview: unknown[] }>;
  const submitted = typedAttempts.filter(attempt => attempt.status === 'submitted' || attempt.status === 'auto_submitted');
  const summary = {
    total: attempts.length,
    live: attempts.filter(attempt => attempt.status === 'in_progress').length,
    submitted: submitted.length,
    averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : 0,
    violations: attempts.reduce((sum, attempt) => {
      const v = attempt.violations as { tabSwitches?: number; fullScreenExits?: number } | undefined;
      return sum + (v?.tabSwitches || 0) + (v?.fullScreenExits || 0);
    }, 0),
  };
  const { questions: _questions, ...exam } = rawExam;
  return NextResponse.json({ success: true, exam: { ...exam, questionCount: questions.length }, summary, attempts: attemptsWithReview });
}
