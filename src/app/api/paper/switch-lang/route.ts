import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { getTeacherVisibleQuestionIssue, keepTeacherSafeQuestions } from '@/lib/question-quality';

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

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    const updatedQuestions = await Promise.all(
      questions.map(async (q: any) => {
        // If already in target language, keep it
        if (q.lang === targetLang) return getTeacherVisibleQuestionIssue(q) ? null : q;

        const numId = Number(q.id);
        let match = null;

        // 1. Try finding counterpart by same numeric id
        if (numId) {
          match = await questionsCol.findOne({ id: numId, lang: targetLang });
        }

        // 2. If no direct pair, find same subject, topic, difficulty
        if (!match && q.subject) {
          const query: any = { subject: q.subject, lang: targetLang };
          if (q.topic) query.topic = q.topic;
          if (q.difficulty !== undefined && q.difficulty !== null) query.difficulty = String(q.difficulty);

          match = await questionsCol.findOne(query);

          if (!match) {
            match = await questionsCol.findOne({ subject: q.subject, lang: targetLang });
          }
        }

        if (!match) {
          // If no match found, keep current question but update lang flag
          return { ...q, lang: targetLang };
        }

        const [safeMatch] = await keepTeacherSafeQuestions(db, [match]);
        if (!safeMatch) return null;

        return {
          _id: safeMatch._id ? String(safeMatch._id) : `${safeMatch.id}_${targetLang}`,
          id: safeMatch.id,
          pyq_id: safeMatch.pyq_id || 0,
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
      })
    );

    const visibleQuestions = updatedQuestions.filter(Boolean);
    if (visibleQuestions.length !== questions.length) {
      return NextResponse.json({ success: false, error: 'One or more translated questions need admin formatting review.' }, { status: 422 });
    }
    return NextResponse.json({
      success: true,
      questions: visibleQuestions,
    });
  } catch (error: any) {
    console.error('paper switch-lang error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to switch paper language.' },
      { status: 500 }
    );
  }
}
