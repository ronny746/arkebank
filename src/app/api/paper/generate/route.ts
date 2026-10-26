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
      scopes = [],
      totalQuestions = 25,
      difficultyDistribution = { easy: 30, medium: 50, hard: 20 },
      lang = 'all',
      hasImageOnly = false,
      pyqOnly = false,
      questionType = 'all', // 'all' (mix) | 'mcq' | 'subjective' | 'numerical' | 'true_false'
      marksPerQuestion = 4,
      negativeMarks = 1,
      assessmentTarget = 'school',
      assessmentType = 'chapter',
      competitiveExam = '',
      enforceAssessmentRule = true,
    } = body;

    const competitive = assessmentTarget === 'competitive';
    const requestedSubjects = Array.isArray(subjects) && subjects.length
      ? subjects.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim()))
      : (subject && subject !== 'all' ? [subject] : []);
    // A JEE Advanced combined paper is a PCM paper by definition. Enforce the
    // same scope server-side so a stale client or crafted request cannot make
    // an incomplete one-subject "Advanced" paper.
    const subjectList = competitive && competitiveExam === 'JEE Advanced' && ['part', 'full'].includes(assessmentType)
      ? ['Physics', 'Chemistry', 'Mathematics']
      : requestedSubjects;
    const selectedSubject = subjectList[0] || subject;
    const derivedCount = (() => {
      if (!competitive) return assessmentType === 'full' ? 50 : null;
      if (assessmentType === 'full') return competitiveExam === 'NEET' ? 180 : competitiveExam === 'JEE Advanced' ? 54 : 75;
      if (assessmentType === 'chapter') return competitiveExam === 'NEET' ? (selectedSubject === 'Biology' ? 90 : 45) : competitiveExam === 'JEE Advanced' ? 18 : 25;
      if (competitiveExam === 'NEET') return subjectList.reduce((sum: number, item: string) => sum + (item === 'Biology' ? 90 : 45), 0);
      return (competitiveExam === 'JEE Advanced' ? 18 : 25) * Math.max(1, subjectList.length);
    })();
    const totalCount = Math.max(1, Math.min(180, (enforceAssessmentRule ? derivedCount : null) || parseInt(String(totalQuestions), 10) || 25));

    // Calculate count per difficulty
    const percentage = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.floor(parsed) : fallback;
    };
    // Do not use `value || fallback` here: 0% is an intentional selection.
    const easyPct = percentage(difficultyDistribution?.easy, 30);
    const medPct = percentage(difficultyDistribution?.medium, 50);
    const hardPct = percentage(difficultyDistribution?.hard, 20);
    const sumPct = easyPct + medPct + hardPct;
    if (sumPct !== 100) {
      return NextResponse.json({ success: false, error: `Difficulty split must total exactly 100% (received ${sumPct}%).` }, { status: 400 });
    }
    const allocateTargets = (count: number, ratios: number[]) => {
      const exact = ratios.map((ratio) => (count * ratio) / 100);
      const targets = exact.map(Math.floor);
      let remaining = count - targets.reduce((sum, target) => sum + target, 0);
      [...exact.keys()].sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a]))).forEach((index) => {
        if (remaining > 0) { targets[index] += 1; remaining -= 1; }
      });
      return targets;
    };
    const [easyTarget, medTarget, hardTarget] = allocateTargets(totalCount, [easyPct, medPct, hardPct]);

    // Build base filter
    const baseMatch: Record<string, any> = {};

    if (class_std && class_std !== 'all') {
      const competitiveSource = competitive && ['JEE Main', 'JEE Advanced', 'NEET'].includes(competitiveExam);
      baseMatch.class_std = competitiveSource
        ? { $in: [...new Set([class_std, 'Class 11', 'Class 12'])] }
        : class_std;
    }
    if (subjectList.length > 0) {
      baseMatch.subject = { $in: subjectList };
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
    const exactScopes = Array.isArray(scopes)
      ? scopes.filter((scope: unknown): scope is { subject: string; topic: string } =>
        Boolean(scope) && typeof (scope as { subject?: unknown }).subject === 'string' && typeof (scope as { topic?: unknown }).topic === 'string',
      )
      : [];
    if (exactScopes.length) {
      baseMatch.$and = [
        ...(Array.isArray(baseMatch.$and) ? baseMatch.$and : []),
        { $or: exactScopes.map((scope) => ({ subject: scope.subject, topic: scope.topic })) },
      ];
    }

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

    // 3. Hard Questions (Tier 3 only). Tier 4 is Expert, not Hard.
    if (hardTarget > 0) {
      const hardDocs = await sampleTier({ $in: ['3', 3] }, hardTarget, Array.from(collectedIds));
      hardDocs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // Never backfill a missing difficulty with another level. A 100% Hard
    // request must never contain easy/medium records merely to hit the count.
    const deficit = totalCount - allQuestions.length;
    if (deficit > 0) {
      return NextResponse.json({
        success: false,
        error: `Only ${allQuestions.length} of ${totalCount} questions match the requested difficulty distribution. Change the split, scope, or filters; no mixed-difficulty backfill was used.`,
        available: allQuestions.length,
        requested: totalCount,
      }, { status: 422 });
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
