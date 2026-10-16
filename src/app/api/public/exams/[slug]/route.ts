import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { cached } from '@/lib/cache';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const exam = await cached(`exam:public:${slug}`, 60, async () => {
      const { db } = await connectToDatabase();
      return await db.collection('exams').findOne(
        { slug },
        { projection: { 'questions.correct_option': 0, 'questions.correct_answer': 0, 'questions.solution': 0 } }
      );
    });

    if (!exam || exam.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Exam not found or unavailable.' }, { status: 404 });
    }

    const now = Date.now();
    if (now < new Date(String(exam.startsAt)).getTime() || now > new Date(String(exam.endsAt)).getTime()) {
      return NextResponse.json({ success: false, error: 'This exam is not available at this time.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, exam });
  } catch (err: any) {
    console.error('Public exam fetch error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load exam.' }, { status: 500 });
  }
}
