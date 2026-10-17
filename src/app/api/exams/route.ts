import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { delCache } from '@/lib/cache';
import { getPublicExamUrl } from '@/lib/public-url';

const admin = (req: Request) => extractAndVerifyToken(req);

export async function GET(req: Request) {
  if (!admin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { db } = await connectToDatabase();
  const exams = await db.collection('exams').aggregate([
    { $lookup: { from: 'exam_attempts', localField: 'id', foreignField: 'examId', as: 'attempts' } },
    {
      $addFields: {
        questionCount: { $size: { $ifNull: ['$questions', []] } },
        attemptCount: { $size: '$attempts' },
        liveCount: { $size: { $filter: { input: '$attempts', as: 'attempt', cond: { $eq: ['$$attempt.status', 'in_progress'] } } } },
        submittedCount: { $size: { $filter: { input: '$attempts', as: 'attempt', cond: { $in: ['$$attempt.status', ['submitted', 'auto_submitted']] } } } },
      },
    },
    { $project: { questions: 0, attempts: 0 } }, { $sort: { updatedAt: -1 } },
  ]).toArray();
  return NextResponse.json({ success: true, exams });
}

export async function POST(req: Request) {
  const user = admin(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body?.paper || !Array.isArray(body.paper.questions) || body.paper.questions.length === 0 || !body.title?.trim()) {
    return NextResponse.json({ success: false, error: 'Exam title and a non-empty paper are required.' }, { status: 400 });
  }
  const durationMinutes = Math.max(1, Math.min(360, Number(body.durationMinutes) || 60));
  const startsAt = new Date(body.startsAt || Date.now());
  const endsAt = new Date(body.endsAt || startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) {
    return NextResponse.json({ success: false, error: 'Choose a valid start and end time.' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const seenQuestionIds = new Set<string>();
  const uniqueQuestions = body.paper.questions.filter((question: Record<string, unknown>) => {
    const key = String(question._id || question.id || '');
    if (!key || seenQuestionIds.has(key)) return false;
    seenQuestionIds.add(key);
    return true;
  });
  if (!uniqueQuestions.length) {
    return NextResponse.json({ success: false, error: 'The paper must contain at least one unique question.' }, { status: 400 });
  }
  const exam = {
    id: randomUUID(), slug: randomBytes(18).toString('base64url'), title: body.title.trim(),
    description: String(body.description || ''), paperId: body.paper.id || undefined,
    paper: { title: body.paper.title, class_std: body.paper.class_std, subject: body.paper.subject, timeAllowed: body.paper.timeAllowed, totalMarks: body.paper.totalMarks, instructions: body.paper.instructions || [] },
    questions: uniqueQuestions, status: body.status === 'draft' ? 'draft' : 'published',
    startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), durationMinutes,
    showResultsAfterSubmit: Boolean(body.showResultsAfterSubmit),
    security: { requireFullScreen: body.security?.requireFullScreen !== false, disableCopyPaste: body.security?.disableCopyPaste !== false, maxTabSwitchesAllowed: Math.max(1, Math.min(10, Number(body.security?.maxTabSwitchesAllowed) || 3)) },
    createdBy: user.email, createdAt: now, updatedAt: now,
  };
  const { db } = await connectToDatabase();
  await db.collection('exams').insertOne(exam);
  await delCache(`exam:public:${exam.slug}`);
  return NextResponse.json({
    success: true,
    exam,
    publicUrl: `/e/${exam.slug}`,
    liveUrl: getPublicExamUrl(exam.slug),
    duplicatesRemoved: body.paper.questions.length - uniqueQuestions.length,
  }, { status: 201 });
}
