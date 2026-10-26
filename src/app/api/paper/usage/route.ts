import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { tenantDocumentQuery } from '@/lib/tenant';

type StoredQuestion = { _id?: string | number; id?: string | number };

/**
 * Returns only paper and exam references needed to warn a faculty member
 * about reusing a question. Question content is never returned from here.
 */
export async function POST(req: Request) {
  try {
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Access denied.' }, { status: 401 });
    }

    const body = await req.json();
    const rawIds: string[] = Array.isArray(body.questionIds)
      ? body.questionIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];
    const questionIds: string[] = Array.from(new Set(rawIds)).slice(0, 250);
    const excludePaperId = typeof body.excludePaperId === 'string' ? body.excludePaperId : '';

    if (!questionIds.length) return NextResponse.json({ success: true, usage: {} });

    const numericIds: number[] = questionIds
      .filter((value) => /^\d+$/.test(value))
      .map((value) => Number(value));

    const { db } = await connectToDatabase();
    const questionMatch = {
      $or: [
        { 'questions._id': { $in: questionIds } },
        ...(numericIds.length ? [{ 'questions.id': { $in: numericIds } }] : []),
      ],
    };
    const [papers, exams] = await Promise.all([
      db.collection('papers')
      .find(
        {
          $and: [
            tenantDocumentQuery(authUser.tenantId),
            ...(excludePaperId ? [{ id: { $ne: excludePaperId } }] : []),
            questionMatch,
          ],
        },
        { projection: { id: 1, title: 1, updatedAt: 1, createdAt: 1, questions: 1 } },
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray(),
      db.collection('exams')
        .find({ $and: [tenantDocumentQuery(authUser.tenantId), questionMatch] }, { projection: { id: 1, title: 1, updatedAt: 1, createdAt: 1, questions: 1 } })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray(),
    ]);

    const requestedIds = new Set(questionIds);
    const usage: Record<string, Array<{ paperId: string; title: string; updatedAt?: string }>> = {};

    const collectUsage = (record: any, source: 'Paper' | 'Exam') => {
      const seenInPaper = new Set<string>();
      (Array.isArray(record.questions) ? record.questions : []).forEach((question: StoredQuestion) => {
        [question._id, question.id]
          .map((value) => String(value ?? ''))
          .filter((value) => requestedIds.has(value))
          .forEach((questionId) => {
            if (seenInPaper.has(questionId)) return;
            seenInPaper.add(questionId);
            usage[questionId] ??= [];
            usage[questionId].push({
              paperId: String(record.id || record._id),
              title: `${source}: ${String(record.title || `Untitled ${source.toLowerCase()}`)}`,
              updatedAt: record.updatedAt || record.createdAt,
            });
          });
      });
    };

    papers.forEach((paper) => collectUsage(paper, 'Paper'));
    exams.forEach((exam) => collectUsage(exam, 'Exam'));

    return NextResponse.json({ success: true, usage });
  } catch (error: unknown) {
    console.error('Question usage lookup failed:', error);
    return NextResponse.json({ success: false, error: 'Could not check question history.' }, { status: 500 });
  }
}
