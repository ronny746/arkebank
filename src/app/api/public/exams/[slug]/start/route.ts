import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const body = await req.json();
  if (!body?.name?.trim() || !body?.email?.trim() || !body?.phone?.trim()) return NextResponse.json({ success: false, error: 'Name, email, and phone are required.' }, { status: 400 });
  const { db } = await connectToDatabase(); const exam = await db.collection('exams').findOne({ slug, status: 'published' });
  if (!exam || Date.now() < new Date(String(exam.startsAt)).getTime() || Date.now() > new Date(String(exam.endsAt)).getTime()) return NextResponse.json({ success: false, error: 'This exam is unavailable.' }, { status: 403 });
  const startedAt = new Date().toISOString();
  const attempt = { id: randomUUID(), examId: String(exam.id), sessionToken: randomBytes(24).toString('base64url'), student: { name: body.name.trim(), email: body.email.trim(), phone: body.phone.trim() }, answers: {}, violations: { tabSwitches: 0, fullScreenExits: 0 }, currentQuestion: 0, startedAt, updatedAt: startedAt, status: 'in_progress' };
  await db.collection('exam_attempts').insertOne(attempt); return NextResponse.json({ success: true, attemptId: attempt.id, sessionToken: attempt.sessionToken, durationMinutes: exam.durationMinutes });
}
