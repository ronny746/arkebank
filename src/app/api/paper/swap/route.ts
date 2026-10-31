import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { keepTeacherSafeQuestions } from '@/lib/question-quality';

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

    if (class_std && class_std !== 'all') matchQuery.class_std = class_std;
    if (subject && subject !== 'all') matchQuery.subject = subject;
    if (topic && topic !== 'all') matchQuery.topic = topic;
    if (difficulty && difficulty !== 'all') matchQuery.difficulty = String(difficulty);
    if (lang && lang !== 'all') matchQuery.lang = lang;

    if (Array.isArray(excludeIds) && excludeIds.length > 0) {
      matchQuery._id = { $nin: excludeIds };
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
