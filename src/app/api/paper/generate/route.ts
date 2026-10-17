import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { withQuestionType } from '@/lib/question-types';

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

    const body = await req.json();
    const {
      class_std = 'all',
      subject = 'all',
      subjects = [],
      topics = [],
      totalQuestions = 25,
      difficultyDistribution = { easy: 30, medium: 50, hard: 20 },
      lang = 'all',
      hasImageOnly = false,
      pyqOnly = false,
      questionType = 'all', // 'all' (mix) | 'mcq' | 'subjective' | 'numerical' | 'true_false'
      marksPerQuestion = 4,
      negativeMarks = 1,
    } = body;

    const totalCount = Math.max(5, Math.min(180, parseInt(String(totalQuestions), 10) || 25));

    // Calculate count per difficulty
    const easyPct = Number(difficultyDistribution?.easy) || 30;
    const medPct = Number(difficultyDistribution?.medium) || 50;
    const hardPct = Number(difficultyDistribution?.hard) || 20;
    const sumPct = easyPct + medPct + hardPct || 100;

    let easyTarget = Math.round((easyPct / sumPct) * totalCount);
    let hardTarget = Math.round((hardPct / sumPct) * totalCount);
    let medTarget = totalCount - easyTarget - hardTarget;
    if (medTarget < 0) {
      medTarget = 0;
      easyTarget = Math.floor(totalCount / 2);
      hardTarget = totalCount - easyTarget;
    }

    // Build base filter
    const baseMatch: Record<string, any> = {};

    if (class_std && class_std !== 'all') {
      baseMatch.class_std = class_std;
    }
    if (Array.isArray(subjects) && subjects.length > 0) {
      baseMatch.subject = { $in: subjects.filter((item: unknown) => typeof item === 'string' && item.trim()) };
    } else if (subject && subject !== 'all') {
      baseMatch.subject = subject;
    }
    if (Array.isArray(topics) && topics.length > 0) {
      baseMatch.topic = { $in: topics };
    }
    if (lang && lang !== 'all') {
      baseMatch.lang = lang;
    }
    if (hasImageOnly) {
      baseMatch.$or = [
        { question_image: { $ne: '' } },
        { solution_image: { $ne: '' } },
      ];
    }
    if (pyqOnly) {
      baseMatch.year = { $gt: 1990 };
    }
    Object.assign(baseMatch, withQuestionType(baseMatch, questionType));

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    // Sampling helper using MongoDB aggregation $sample
    const sampleTier = async (diffCondition: any, count: number, excludeIds: any[]) => {
      if (count <= 0) return [];
      const tierMatch: Record<string, any> = { ...baseMatch, difficulty: diffCondition };
      if (excludeIds.length > 0) {
        tierMatch._id = { $nin: excludeIds };
      }

      const pipeline = [
        { $match: tierMatch },
        { $sample: { size: count } },
      ];

      return await questionsCol.aggregate(pipeline).toArray();
    };

    const collectedIds = new Set<string>();
    const allQuestions: any[] = [];

    // 1. Easy Questions (Tier 0 & 1)
    if (easyTarget > 0) {
      const easyDocs = await sampleTier({ $in: ['0', '1', 0, 1] }, easyTarget, Array.from(collectedIds));
      easyDocs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // 2. Medium Questions (Tier 2)
    if (medTarget > 0) {
      const medDocs = await sampleTier({ $in: ['2', 2] }, medTarget, Array.from(collectedIds));
      medDocs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // 3. Hard Questions (Tier 3 & 4)
    if (hardTarget > 0) {
      const hardDocs = await sampleTier({ $in: ['3', '4', 3, 4] }, hardTarget, Array.from(collectedIds));
      hardDocs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // 4. Backfill if any tier lacked enough questions to hit totalCount
    const deficit = totalCount - allQuestions.length;
    if (deficit > 0) {
      const backfillMatch = { ...baseMatch };
      if (collectedIds.size > 0) {
        backfillMatch._id = { $nin: Array.from(collectedIds) };
      }
      const backfillDocs = await questionsCol
        .aggregate([
          { $match: backfillMatch },
          { $sample: { size: deficit } },
        ])
        .toArray();

      backfillDocs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // Format questions with default marks and numbering
    const formattedQuestions = allQuestions.map((q, idx) => ({
      ...q,
      orderIndex: idx + 1,
      marks: Number(marksPerQuestion) || 4,
      negative_marks: Number(negativeMarks) || 1,
    }));

    return NextResponse.json({
      success: true,
      totalGenerated: formattedQuestions.length,
      requestedCount: totalCount,
      questions: formattedQuestions,
    });
  } catch (error: any) {
    console.error('Paper Generation Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate question paper' },
      { status: 500 }
    );
  }
}
