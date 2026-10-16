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

    return NextResponse.json({
      success: true,
      question: {
        _id: matchedDoc._id ? String(matchedDoc._id) : `${matchedDoc.id}_${targetLang}`,
        id: matchedDoc.id,
        pyq_id: matchedDoc.pyq_id || 0,
        lang: matchedDoc.lang || targetLang,
        class_std: matchedDoc.class_std,
        subject: matchedDoc.subject,
        subject_id: matchedDoc.subject_id,
        topic: matchedDoc.topic,
        topic_id: matchedDoc.topic_id,
        sub_topic: matchedDoc.sub_topic,
        sub_topic_id: matchedDoc.sub_topic_id,
        difficulty: matchedDoc.difficulty,
        year: matchedDoc.year,
        paper: matchedDoc.paper,
        question_exams: matchedDoc.question_exams || [],
        question: matchedDoc.question,
        question_image: matchedDoc.question_image || '',
        options: matchedDoc.options || [],
        correct_option: matchedDoc.correct_option,
        correct_answer: matchedDoc.correct_answer,
        solution: matchedDoc.solution || '',
        solution_image: matchedDoc.solution_image || '',
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
