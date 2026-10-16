import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!extractAndVerifyToken(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const { db } = await connectToDatabase();
    const numericId = Number(id);
    const filter: Record<string, unknown> = Number.isNaN(numericId)
      ? { $or: [{ _id: id }, { id }] }
      : { $or: [{ _id: id }, { id: numericId }] };
    const question = await db.collection('questions').findOne(filter);
    if (!question) return NextResponse.json({ success: false, error: 'Question not found.' }, { status: 404 });
    return NextResponse.json({ success: true, question });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Could not load question.' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict Token Verification: Only authenticated admins can modify questions
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access Denied: Valid administrator authentication token is required to edit questions.',
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const { db } = await connectToDatabase();
    const questionsCol = db.collection<any>('questions');

    const {
      class_std,
      subject,
      subject_id,
      topic,
      topic_id,
      sub_topic,
      sub_topic_id,
      difficulty,
      lang,
      year,
      paper,
      question_exams,
      correct_option,
      correct_answer,
      question,
      options,
      solution,
    } = body;

    const updateFields: any = {};
    if (class_std !== undefined) updateFields.class_std = class_std;
    if (subject !== undefined) updateFields.subject = subject;
    if (subject_id !== undefined) updateFields.subject_id = subject_id !== null && subject_id !== '' ? Number(subject_id) : null;
    if (topic !== undefined) updateFields.topic = topic;
    if (topic_id !== undefined) updateFields.topic_id = topic_id !== null && topic_id !== '' ? Number(topic_id) : null;
    if (sub_topic !== undefined) updateFields.sub_topic = sub_topic;
    if (sub_topic_id !== undefined) updateFields.sub_topic_id = sub_topic_id !== null && sub_topic_id !== '' ? Number(sub_topic_id) : null;
    if (difficulty !== undefined) updateFields.difficulty = String(difficulty);
    if (lang !== undefined) updateFields.lang = lang;
    if (year !== undefined) updateFields.year = Number(year) || 0;
    if (paper !== undefined) updateFields.paper = paper;
    if (question_exams !== undefined) {
      updateFields.question_exams = Array.isArray(question_exams)
        ? question_exams
        : String(question_exams).split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (correct_option !== undefined) updateFields.correct_option = correct_option;
    if (correct_answer !== undefined) updateFields.correct_answer = correct_answer;
    if (question !== undefined) updateFields.question = question;
    if (options !== undefined) updateFields.options = options;
    if (solution !== undefined) updateFields.solution = solution;

    updateFields.updated_at = new Date();

    const filter: any = isNaN(Number(id)) ? { _id: id } : { $or: [{ _id: id }, { id: Number(id) }] };

    const result = await questionsCol.findOneAndUpdate(
      filter,
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Question updated successfully',
      question: result,
    });
  } catch (error: any) {
    console.error('Update question error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
