import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { keepTeacherSafeQuestions } from '@/lib/question-quality';
import { questionIdVariants } from '@/lib/question-ids';
import { applyTenantDatasetScope } from '@/lib/tenant';

export async function POST(req: Request) {
  try {
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access Denied: Valid administrator authentication token is required.',
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      class_std,
      subject,
      topic,
      difficulty,
      lang,
      excludeIds = [],
    } = body;

    const matchQuery: Record<string, any> = {};
    // Only plain strings reach the query; an object here could inject operators.
    const text = (value: unknown) => (typeof value === 'string' && value && value !== 'all' ? value : null);

    if (text(class_std)) matchQuery.class_std = class_std;
    if (text(subject)) matchQuery.subject = subject;
    if (text(topic)) matchQuery.topic = topic;
    if (typeof difficulty === 'number' || text(difficulty)) matchQuery.difficulty = String(difficulty);
    if (text(lang)) matchQuery.lang = lang;
    applyTenantDatasetScope(matchQuery, authUser.tenantId);

    // Paper ids arrive as strings, but third-dataset rows use ObjectId `_id`s;
    // without both forms the "replacement" could be a question already on the paper.
    const excluded = questionIdVariants(excludeIds);
    if (excluded.length > 0) {
      matchQuery._id = { $nin: excluded };
    }

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    const replacement = await questionsCol
      .aggregate([
        { $match: matchQuery },
        { $sample: { size: 8 } },
      ])
      .toArray();

    if (!replacement || replacement.length === 0) {
      // Fallback without topic constraint if topic had only 1 question
      delete matchQuery.topic;
      const fallback = await questionsCol
        .aggregate([
          { $match: matchQuery },
          { $sample: { size: 1 } },
        ])
        .toArray();

      if (!fallback || fallback.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No alternate questions found matching criteria.' },
          { status: 404 }
        );
      }

      const safeFallback = await keepTeacherSafeQuestions(db, fallback);
      if (!safeFallback.length) {
        return NextResponse.json({ success: false, error: 'Matching alternate questions need an admin formatting review.' }, { status: 422 });
      }
      return NextResponse.json({
        success: true,
        question: safeFallback[0],
      });
    }

    const safeReplacement = await keepTeacherSafeQuestions(db, replacement);
    if (!safeReplacement.length) {
      return NextResponse.json({ success: false, error: 'Matching alternate questions need an admin formatting review.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      question: safeReplacement[0],
    });
  } catch (error: any) {
    console.error('Swap Question Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to swap question' },
      { status: 500 }
    );
  }
}
