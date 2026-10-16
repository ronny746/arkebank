import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

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
        if (q.lang === targetLang) return q;

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

        return {
          _id: match._id ? String(match._id) : `${match.id}_${targetLang}`,
          id: match.id,
          pyq_id: match.pyq_id || 0,
          lang: match.lang || targetLang,
          class_std: match.class_std || q.class_std,
          subject: match.subject || q.subject,
          subject_id: match.subject_id || q.subject_id,
          topic: match.topic || q.topic,
          topic_id: match.topic_id || q.topic_id,
          sub_topic: match.sub_topic || q.sub_topic,
          sub_topic_id: match.sub_topic_id || q.sub_topic_id,
          difficulty: match.difficulty || q.difficulty,
          year: match.year || q.year,
          paper: match.paper || q.paper,
          question_exams: match.question_exams || q.question_exams || [],
          question: match.question,
          question_image: match.question_image || '',
          options: match.options || [],
          correct_option: match.correct_option,
          correct_answer: match.correct_answer,
          solution: match.solution || '',
          solution_image: match.solution_image || '',
          marks: q.marks || 4,
          negative_marks: q.negative_marks || 1,
        };
      })
    );

    return NextResponse.json({
      success: true,
      questions: updatedQuestions,
    });
  } catch (error: any) {
    console.error('paper switch-lang error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to switch paper language.' },
      { status: 500 }
    );
  }
}
