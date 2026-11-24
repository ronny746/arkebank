import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { getTeacherVisibleQuestionIssue, keepTeacherSafeQuestions } from '@/lib/question-quality';
import { pairingIdCandidates, questionIdVariants } from '@/lib/question-ids';
import { applyTenantDatasetScope } from '@/lib/tenant';

// Paper questions arrive from the browser; treat every field as untrusted.
type IncomingQuestion = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid token required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { questions, targetLang } = body;

    if (!Array.isArray(questions) || !targetLang || !['en', 'hi'].includes(targetLang)) {
      return NextResponse.json(
        { success: false, error: 'Invalid input. questions array and targetLang ("en" | "hi") required.' },
        { status: 400 }
      );
    }
    // Each question costs up to three lookups; papers top out at 180 questions.
    if (questions.length > 200) {
      return NextResponse.json({ success: false, error: 'Invalid input. questions array and targetLang ("en" | "hi") required.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    // Questions are matched sequentially (not Promise.all) so every pick can
    // exclude rows already used. Previously several English questions without
    // an exact twin resolved to the same Hindi row and the client then
    // silently de-duplicated the paper down to fewer questions.
    const usedIds = new Set<string>(
      (questions as IncomingQuestion[]).filter((q) => q?.lang === targetLang).map((q) => String(q._id || q.id)),
    );
    let unmatchedCount = 0;
    const scoped = (query: Record<string, unknown>, dataset?: unknown) => {
      const variants = questionIdVariants([...usedIds]);
      return applyTenantDatasetScope(variants.length ? { ...query, _id: { $nin: variants } } : query, authUser.tenantId, dataset);
    };
    const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

    const updatedQuestions: Array<IncomingQuestion | null> = [];
    for (const q of questions as IncomingQuestion[]) {
      updatedQuestions.push(await (async () => {
        // If already in target language, keep it
        if (q.lang === targetLang) return getTeacherVisibleQuestionIssue(q as Parameters<typeof getTeacherVisibleQuestionIssue>[0]) ? null : q;

        let match = null;

        // 1. The real translation shares the pairing `id` within the same
        // dataset. Third-dataset ids are strings, which a numeric-only
        // lookup never found.
        const idCandidates = pairingIdCandidates(q.id);
        if (idCandidates.length) {
          const pairQuery: Record<string, unknown> = { id: { $in: idCandidates }, lang: targetLang };
          // Same dataset only (numeric ids repeat across banks); the scope helper
          // still refuses a dataset this portal hides.
          match = await questionsCol.findOne(scoped(pairQuery, text(q.dataset)));
        }

        // 2. If no direct pair, find same subject, topic, difficulty
        if (!match && text(q.subject)) {
          const query: Record<string, unknown> = { subject: q.subject, lang: targetLang };
          if (text(q.topic)) query.topic = q.topic;
          if (typeof q.difficulty === 'string' || typeof q.difficulty === 'number') query.difficulty = String(q.difficulty);

          match = await questionsCol.findOne(scoped(query));

          if (!match) {
            match = await questionsCol.findOne(scoped({ subject: q.subject, lang: targetLang }));
          }
        }

        if (!match) {
          // Keep the question exactly as it is. Relabelling an English question
          // as Hindi (the old behaviour) misled faculty about the paper's language.
          unmatchedCount += 1;
          usedIds.add(String(q._id || q.id));
          return q;
        }
        usedIds.add(String(match._id || match.id));

        const [safeMatch] = await keepTeacherSafeQuestions(db, [match]);
        if (!safeMatch) return null;

        return {
          _id: safeMatch._id ? String(safeMatch._id) : `${safeMatch.id}_${targetLang}`,
          id: safeMatch.id,
          pyq_id: safeMatch.pyq_id || 0,
          // Kept so a later switch back can pair within the same dataset.
          dataset: safeMatch.dataset || q.dataset,
          lang: safeMatch.lang || targetLang,
          class_std: safeMatch.class_std || q.class_std,
          subject: safeMatch.subject || q.subject,
          subject_id: safeMatch.subject_id || q.subject_id,
          topic: safeMatch.topic || q.topic,
          topic_id: safeMatch.topic_id || q.topic_id,
          sub_topic: safeMatch.sub_topic || q.sub_topic,
          sub_topic_id: safeMatch.sub_topic_id || q.sub_topic_id,
          difficulty: safeMatch.difficulty || q.difficulty,
          year: safeMatch.year || q.year,
          paper: safeMatch.paper || q.paper,
          question_exams: safeMatch.question_exams || q.question_exams || [],
          question: safeMatch.question,
          question_image: safeMatch.question_image || '',
          options: safeMatch.options || [],
          correct_option: safeMatch.correct_option,
          correct_answer: safeMatch.correct_answer,
          solution: safeMatch.solution || '',
          solution_image: safeMatch.solution_image || '',
          marks: q.marks || 4,
          negative_marks: q.negative_marks || 1,
        };
      })());
    }

    const visibleQuestions = updatedQuestions.filter(Boolean);
    if (visibleQuestions.length !== questions.length) {
      return NextResponse.json({ success: false, error: 'One or more translated questions need admin formatting review.' }, { status: 422 });
    }
    return NextResponse.json({
      success: true,
      questions: visibleQuestions,
      unmatchedCount,
    });
  } catch (error: any) {
    console.error('paper switch-lang error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to switch paper language.' },
      { status: 500 }
    );
  }
}
