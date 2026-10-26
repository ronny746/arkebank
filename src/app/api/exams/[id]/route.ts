import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { delCache, delCachePattern } from '@/lib/cache';
import { tenantDocumentQuery } from '@/lib/tenant';

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
    const examsCol = db.collection('exams');
    const attemptsCol = db.collection('exam_attempts');

    // Find the exam first to get its slug for cache invalidation
    const exam = await examsCol.findOne({
      $and: [tenantDocumentQuery(authUser.tenantId), { $or: [{ id }, { slug: id }] }],
    });
    if (!exam) {
      return NextResponse.json(
        { success: false, error: 'Exam not found' },
        { status: 404 }
      );
    }

    // Delete the exam
    await examsCol.deleteOne({ _id: exam._id });

    // Also remove any attempts for this exam
    await attemptsCol.deleteMany({ examId: exam.id, ...tenantDocumentQuery(authUser.tenantId) });

    // Invalidate Redis/Memory caches
    if (exam.slug) {
      await delCache(`exam:public:${authUser.tenantId}:${exam.slug}`);
    }
    await delCachePattern('exam:*');

    return NextResponse.json({
      success: true,
      message: `Exam "${exam.title}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Delete Exam Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete exam' },
      { status: 500 }
    );
  }
}
