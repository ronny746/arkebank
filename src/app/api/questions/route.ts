import { cached } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

export async function GET(req: Request) {
  try {
    // 1. Strict Token Verification: Block unauthenticated scraping/direct access
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access Denied: Valid administrator authentication token is required. Direct API access is strictly forbidden.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
    const skip = (page - 1) * limit;

    const class_std = searchParams.get('class_std');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const sub_topic = searchParams.get('sub_topic');
    const difficulty = searchParams.get('difficulty');
    const lang = searchParams.get('lang');
    const year = searchParams.get('year');
    const exam = searchParams.get('exam');
    const has_image = searchParams.get('has_image');
    const search = searchParams.get('search');

    const query: any = {};

    if (class_std && class_std !== 'all') {
      query.class_std = class_std;
    }
    if (subject && subject !== 'all') {
      query.subject = subject;
    }
    if (topic && topic !== 'all') {
      query.topic = topic;
    }
    if (sub_topic && sub_topic !== 'all') {
      query.sub_topic = sub_topic;
    }
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty;
    }
    if (lang && lang !== 'all') {
      query.lang = lang;
    }
    if (year && year !== 'all' && !isNaN(Number(year))) {
      query.year = Number(year);
    }
    if (exam && exam !== 'all') {
      query.question_exams = { $regex: exam, $options: 'i' };
    }
    if (has_image === 'true') {
      query.$or = [
        { question_image: { $ne: '' } },
        { solution_image: { $ne: '' } }
      ];
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      if (!isNaN(Number(term))) {
        query.id = Number(term);
      } else {
        query.question = { $regex: term, $options: 'i' };
      }
    }

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    const isUnfiltered = Object.keys(query).length === 0;

    // Fast count: estimatedDocumentCount for unfiltered, cached count for filtered queries
    const countPromise = isUnfiltered
      ? questionsCol.estimatedDocumentCount()
      : cached(`qcount:${JSON.stringify(query)}`, 600, () => questionsCol.countDocuments(query));

    const questionsPromise = questionsCol
      .find(query)
      .sort({ topic_id: 1, sub_topic_id: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const [total, questions] = await Promise.all([countPromise, questionsPromise]);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      questions
    });
  } catch (error: any) {
    console.error('Questions API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
