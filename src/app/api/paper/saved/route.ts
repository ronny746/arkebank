import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { cached } from '@/lib/cache';

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);

    const { db } = await connectToDatabase();
    const papersCol = db.collection('papers');

    const cacheKey = search
      ? `papers:search:${encodeURIComponent(search.toLowerCase())}:${limit}`
      : `papers:list:${limit}`;

    const papers = await cached(cacheKey, 60, async () => {
      const query: any = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { class_std: { $regex: search, $options: 'i' } },
          { instituteName: { $regex: search, $options: 'i' } },
        ];
      }
      return await papersCol
        .find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .toArray();
    });

    return NextResponse.json({
      success: true,
      papers,
      count: papers.length,
    });
  } catch (error: any) {
    console.error('Fetch Saved Papers Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch saved papers' },
      { status: 500 }
    );
  }
}
