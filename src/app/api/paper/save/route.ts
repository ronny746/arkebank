import { delCache, delCachePattern } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

export async function POST(req: Request) {
  try {
    const authUser = extractAndVerifyToken(req);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access Denied: Valid administrator authentication token is required.',
        },
        { status: 401 }
      );
    }

    const paper = await req.json();

    if (!paper || !paper.title || !Array.isArray(paper.questions) || paper.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid paper data. Title and questions are required.' },
        { status: 400 }
      );
    }

    const paperId = paper.id || `paper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const paperDoc = {
      ...paper,
      id: paperId,
      createdBy: authUser.email,
      updatedAt: nowIso,
      createdAt: paper.createdAt || nowIso,
    };

    const { db } = await connectToDatabase();
    const papersCol = db.collection('papers');

    await delCachePattern('papers:*');
    await delCache(`paper:id:${paperId}`);

    await papersCol.updateOne(
      { id: paperId },
      { $set: paperDoc },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      paperId,
      message: 'Paper saved successfully to database.',
      paper: paperDoc,
    });
  } catch (error: any) {
    console.error('Save Paper Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save question paper' },
      { status: 500 }
    );
  }
}
