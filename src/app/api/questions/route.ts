import { cached } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { withQuestionType } from '@/lib/question-types';
import { keepTeacherSafeQuestions } from '@/lib/question-quality';

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
    // This endpoint is intentionally bounded. A list request must never turn
    // into a bulk export of the question bank in a browser tab.
    const limit = Math.min(25, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
    const cursorMode = searchParams.get('pagination') === 'cursor';
    const rawCursor = searchParams.get('cursor');
    let cursor: { id: number; recordId: string } | null = null;
    if (cursorMode && rawCursor) {
      try {
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
        if (Number.isFinite(Number(decoded?.id)) && typeof decoded?.recordId === 'string') {
          cursor = { id: Number(decoded.id), recordId: decoded.recordId };
        }
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid question cursor.' }, { status: 400 });
      }
    }
    const skip = (page - 1) * limit;

    const class_std = searchParams.get('class_std');
    const format_scope = searchParams.get('format_scope');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const sub_topic = searchParams.get('sub_topic');
    const difficulty = searchParams.get('difficulty');
    const max_difficulty = Number.parseInt(searchParams.get('max_difficulty') || '', 10);
    const lang = searchParams.get('lang');
    const year = searchParams.get('year');
    const exam = searchParams.get('exam');
    const has_image = searchParams.get('has_image');
    const question_type = searchParams.get('question_type');
    const search = searchParams.get('search');
    const scopes = searchParams.getAll('scope')
      .map((value) => value.split('::'))
      .filter((value): value is [string, string] => value.length === 2 && Boolean(value[0]) && Boolean(value[1]));
    const subTopics = searchParams.getAll('sub_topic').filter(Boolean);

    const query: any = {};

    const isCompetitiveAssessment = format_scope === 'assessment'
      && ['JA', 'JM', 'NEET', 'JEE Main', 'JEE Advanced', 'Competitive Exam'].includes(class_std || '');

    if (class_std && class_std !== 'all') {
      // Competitive papers are configured by exam, while their source questions
      // are commonly stored under Class 11 / Class 12. Keep the exam value in
      // the allowed set, but never exclude those source records from preview.
      query.class_std = isCompetitiveAssessment
        ? { $in: [...new Set([class_std, 'Class 11', 'Class 12'])] }
        : class_std;
    }
    if (subject && subject !== 'all') {
      query.subject = subject;
    }
    if (topic && topic !== 'all') {
      query.topic = topic;
    }
    if (subTopics.length > 0) {
      query.sub_topic = { $in: subTopics };
    } else if (sub_topic && sub_topic !== 'all') {
      query.sub_topic = sub_topic;
    }
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty;
    } else if (Number.isInteger(max_difficulty) && max_difficulty >= 0 && max_difficulty <= 4) {
      query.difficulty = { $in: Array.from({ length: max_difficulty + 1 }, (_, tier) => [String(tier), tier]).flat() };
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
    Object.assign(query, withQuestionType(query, question_type));

    // A Paper Studio selection can span different subjects and chapters. Keep
    // each pair together instead of using independent subject/topic arrays,
    // which could otherwise mix unrelated chapters across subjects.
    if (scopes.length > 0) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: scopes.map(([scopeSubject, scopeTopic]) => ({ subject: scopeSubject, topic: scopeTopic })) },
      ];
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

    // Cursor pagination avoids MongoDB walking every previous result for deep
    // pages. We keep page/skip as a compatibility mode for existing callers.
    const resultQuery: Record<string, unknown> = cursor
      ? {
          $and: [
            query,
            {
              $or: [
                { id: { $gt: cursor.id } },
                { id: cursor.id, _id: { $gt: cursor.recordId } },
              ],
            },
          ],
        }
      : query;

    const questionFinder = questionsCol
      .find(resultQuery)
      .sort(cursorMode ? { id: 1, _id: 1 } : { topic_id: 1, sub_topic_id: 1, id: 1 });
    const questionsPromise = cursorMode
      ? questionFinder.limit(limit + 1).toArray()
      : questionFinder.skip(skip).limit(limit).toArray();

    const [total, resultQuestions] = await Promise.all([countPromise, questionsPromise]);
    const hasMore = cursorMode && resultQuestions.length > limit;
    const safeQuestions = await keepTeacherSafeQuestions(db, (cursorMode ? resultQuestions.slice(0, limit) : resultQuestions));
    // English/Hindi translations are separate source rows but one teaching
    // question. Keep one canonical card and expose a language switch instead
    // of making faculty see duplicate questions in the bank.
    const questions = lang === 'all'
      ? [...safeQuestions.reduce((byId, candidate: any) => {
          const key = String(candidate.id || candidate._id);
          const current = byId.get(key);
          if (!current || (String(candidate.lang).toLowerCase() === 'en' && String(current.lang).toLowerCase() !== 'en')) byId.set(key, candidate);
          return byId;
        }, new Map<string, any>()).values()]
      : safeQuestions;
    const numericIds = questions.map((question: any) => Number(question.id)).filter(Number.isFinite);
    const languageRows = numericIds.length
      ? await questionsCol.aggregate([{ $match: { id: { $in: numericIds }, lang: { $in: ['en', 'hi'] } } }, { $group: { _id: '$id', languages: { $addToSet: '$lang' } } }]).toArray()
      : [];
    const languagesById = new Map(languageRows.map((row: any) => [String(row._id), (row.languages || []).sort()]));
    questions.forEach((question: any) => { question.available_languages = languagesById.get(String(question.id)) || [question.lang || 'en']; });
    const lastQuestion = questions[questions.length - 1] as { id?: number; _id?: unknown } | undefined;
    const nextCursor = hasMore && lastQuestion
      ? Buffer.from(JSON.stringify({ id: lastQuestion.id, recordId: String(lastQuestion._id) })).toString('base64url')
      : null;

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      questions,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error('Questions API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
