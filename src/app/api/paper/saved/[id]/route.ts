import { delCache } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

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

    const result = await papersCol.deleteOne({ id });
    await delCache('papers:list:v1');

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
