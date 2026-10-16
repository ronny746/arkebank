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

    const { db } = await connectToDatabase();
    const papersCol = db.collection('papers');

    // High performance caching for saved papers list (TTL: 60s)
    const papers = await cached('papers:list:v1', 60, async () => {
      return await papersCol
        .find({})
        .sort({ updatedAt: -1 })
        .limit(100)
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
