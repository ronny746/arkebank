import { cached, delCache, delCachePattern } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { tenantDocumentQuery } from '@/lib/tenant';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const cacheKey = `paper:${authUser.tenantId}:id:${id}`;

    const paper = await cached(cacheKey, 300, async () => {
      const { db } = await connectToDatabase();
      const papersCol = db.collection('papers');
      return await papersCol.findOne({ id, ...tenantDocumentQuery(authUser.tenantId) });
    });

    if (!paper) {
      return NextResponse.json(
        { success: false, error: 'Question paper not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      paper,
    });
  } catch (error: any) {
    console.error('Fetch Single Paper Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch question paper' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { db } = await connectToDatabase();
    const papersCol = db.collection('papers');

    const result = await papersCol.deleteOne({ id, ...tenantDocumentQuery(authUser.tenantId) });
    await delCachePattern('papers:*');
    await delCache(`paper:id:${id}`);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Paper ${id} deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Delete Paper Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete question paper' },
      { status: 500 }
    );
  }
}
