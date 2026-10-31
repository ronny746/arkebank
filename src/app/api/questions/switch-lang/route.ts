import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { keepTeacherSafeQuestions } from '@/lib/question-quality';

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
    const { questionId, targetLang, subject, topic, difficulty } = body;

    if (!targetLang || !['en', 'hi'].includes(targetLang)) {
      return NextResponse.json(
        { success: false, error: 'targetLang must be "en" or "hi".' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    const numId = Number(questionId);

    // 1. Try finding paired counterpart with same numeric id and targetLang
    let matchedDoc = null;
    if (numId) {
      matchedDoc = await questionsCol.findOne({ id: numId, lang: targetLang });
    }

    // 2. If not found by numeric id, try finding by subject, topic & difficulty
    if (!matchedDoc && subject) {
      const query: any = { subject, lang: targetLang };
      if (topic) query.topic = topic;
      if (difficulty !== undefined && difficulty !== null) query.difficulty = String(difficulty);

      matchedDoc = await questionsCol.findOne(query);

      // Fallback: subject + targetLang only
      if (!matchedDoc) {
        matchedDoc = await questionsCol.findOne({ subject, lang: targetLang });
      }
    }

    // 3. Fallback: any question in targetLang
    if (!matchedDoc) {
      matchedDoc = await questionsCol.findOne({ lang: targetLang });
    }

    if (!matchedDoc) {
      return NextResponse.json(
        { success: false, error: `No question found in language ${targetLang}.` },
        { status: 404 }
      );
    }

    const [safeQuestion] = await keepTeacherSafeQuestions(db, [matchedDoc]);
    if (!safeQuestion) {
      return NextResponse.json({ success: false, error: 'This question needs admin formatting review before it can be shown.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      question: {
        _id: safeQuestion._id ? String(safeQuestion._id) : `${safeQuestion.id}_${targetLang}`,
        id: safeQuestion.id,
        pyq_id: safeQuestion.pyq_id || 0,
        lang: safeQuestion.lang || targetLang,
        class_std: safeQuestion.class_std,
        subject: safeQuestion.subject,
        subject_id: safeQuestion.subject_id,
        topic: safeQuestion.topic,
        topic_id: safeQuestion.topic_id,
        sub_topic: safeQuestion.sub_topic,
        sub_topic_id: safeQuestion.sub_topic_id,
        difficulty: safeQuestion.difficulty,
        year: safeQuestion.year,
        paper: safeQuestion.paper,
        question_exams: safeQuestion.question_exams || [],
        question: safeQuestion.question,
        question_image: safeQuestion.question_image || '',
        options: safeQuestion.options || [],
        correct_option: safeQuestion.correct_option,
        correct_answer: safeQuestion.correct_answer,
        solution: safeQuestion.solution || '',
        solution_image: safeQuestion.solution_image || '',
        marks: body.marks || 4,
        negative_marks: body.negative_marks || 1,
      },
    });
  } catch (error: any) {
    console.error('switch-lang error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to switch language.' },
      { status: 500 }
    );
  }
}
