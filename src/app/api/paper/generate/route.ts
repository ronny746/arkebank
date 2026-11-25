import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { resolveQuestionNegativeMarks, withQuestionType } from '@/lib/question-types';
import { keepTeacherSafeQuestions } from '@/lib/question-quality';
import { applyTenantDatasetScope } from '@/lib/tenant';
import { questionIdVariants } from '@/lib/question-ids';
import { allocateDifficultyTargets, DIFFICULTY_LEVELS, type DifficultyAvailability, type DifficultyLevel } from '@/lib/difficulty-split';
import { t } from '@/lib/i18n';

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
      class_std: rawClassStd = 'all',
      dataset = 'all',
      subject: rawSubject = 'all',
      subjects = [],
      topics: rawTopics = [],
      scopes = [],
      totalQuestions = 25,
      difficultyDistribution = { easy: 30, medium: 50, hard: 20 },
      lang: rawLang = 'all',
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
    // 'availability' answers "how many questions exist per level for this
    // scope?" without sampling, so Paper Studio can warn before generating.
    const availabilityOnly = body?.mode === 'availability';
    // Body values go straight into Mongo filters: accept only plain strings so
    // an object such as {"$regex": ...} cannot become a query operator.
    const asText = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);
    const class_std = asText(rawClassStd, 'all');
    const subject = asText(rawSubject, 'all');
    const lang = asText(rawLang, 'all');
    const topics: string[] = Array.isArray(rawTopics)
      ? rawTopics.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item))
      : [];

    const competitive = assessmentTarget === 'competitive';
    const requestedSubjects = Array.isArray(subjects) && subjects.length
      ? subjects.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim()))
      : (subject && subject !== 'all' ? [subject] : []);
    // PCM is preselected for JEE Advanced in the blueprint, but a faculty
    // member may deliberately tailor the bank paper to a subset. Respect the
    // submitted subject scope instead of restoring deselected subjects.
    const officialFullSyllabusSubjects = competitiveExam === 'NEET'
      ? ['Physics', 'Chemistry', 'Biology']
      : ['Physics', 'Chemistry', 'Mathematics'];
    // Official full-syllabus JEE Main/NEET papers have a fixed subject scope.
    // JEE Advanced intentionally remains teacher-configurable.
    const subjectList = competitive && assessmentType === 'full' && enforceAssessmentRule && competitiveExam !== 'JEE Advanced'
      ? officialFullSyllabusSubjects
      : requestedSubjects;
    const selectedSubject = subjectList[0] || subject;
    const derivedCount = (() => {
      if (!competitive) return assessmentType === 'full' ? 50 : null;
      if (assessmentType === 'full') return competitiveExam === 'NEET' ? 180 : competitiveExam === 'JEE Advanced' ? 18 * Math.max(1, subjectList.length) : 75;
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
    const [easyTarget, medTarget, hardTarget] = allocateDifficultyTargets(totalCount, [easyPct, medPct, hardPct]);

    // Build base filter
    const baseMatch: Record<string, any> = {};
    // Tenant comes from the verified token: ARKE never samples TestlyPro.
    applyTenantDatasetScope(baseMatch, authUser.tenantId, dataset);

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
    const exactScopes = Array.isArray(scopes)
      ? scopes.filter((scope: unknown): scope is { subject: string; topic: string } =>
        Boolean(scope) && typeof (scope as { subject?: unknown }).subject === 'string' && typeof (scope as { topic?: unknown }).topic === 'string',
      )
      : [];
    // A selected chapter is an explicit teacher instruction. Only fall back to
    // the selected subject pool when no chapter/topic scope was selected.
    if (!exactScopes.length && Array.isArray(topics) && topics.length > 0) {
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
    if (exactScopes.length) {
      baseMatch.$and = [
        ...(Array.isArray(baseMatch.$and) ? baseMatch.$and : []),
        { $or: exactScopes.map((scope) => ({ subject: scope.subject, topic: scope.topic })) },
      ];
    }

    const { db } = await connectToDatabase();
    const questionsCol = db.collection('questions');

    // Single source of truth for which stored tiers make up each level, shared
    // by sampling and availability counts. Counts are an upper bound: sampling
    // also drops the rare record with unsafe formatting (~0.1% in production).
    // Standard/Advanced papers may use Tier 3–4; JEE Main and NEET deliberately
    // stop at Tier 3 (no Expert tier).
    const toughTiers = competitive && ['JEE Main', 'NEET'].includes(competitiveExam)
      ? ['3', 3]
      : ['3', '4', 3, 4];
    // PYQ papers use the simpler teacher-facing mapping (PYQ rows only carry
    // Tiers 0–2): Tier 0 = Easy, Tier 1 = Medium, Tier 2 = Hard. Standard papers
    // keep the broader Easy (0–1) / Moderate (2) / Tough (3–4) bands.
    const levelTiers: Record<DifficultyLevel, unknown[]> = pyqOnly
      ? { easy: ['0', 0], medium: ['1', 1], hard: ['2', 2] }
      : { easy: ['0', '1', 0, 1], medium: ['2', 2], hard: toughTiers };
    const levelTargets: Record<DifficultyLevel, number> = { easy: easyTarget, medium: medTarget, hard: hardTarget };

    // Counts are capped at the paper size: anything above it is "enough", and
    // a bounded count stays cheap even on multi-million-row scopes.
    const countAvailability = async (): Promise<DifficultyAvailability> => {
      const counts = await Promise.all(DIFFICULTY_LEVELS.map((level) =>
        questionsCol.countDocuments({ ...baseMatch, difficulty: { $in: levelTiers[level] } }, { limit: totalCount, maxTimeMS: 10000 })));
      return {
        requested: totalCount,
        levels: Object.fromEntries(DIFFICULTY_LEVELS.map((level, index) => [
          level,
          { needed: levelTargets[level], available: counts[index] },
        ])) as DifficultyAvailability['levels'],
      };
    };

    if (availabilityOnly) {
      return NextResponse.json({ success: true, availability: await countAvailability() });
    }

    // Sampling helper using MongoDB aggregation $sample
    const sampleTier = async (diffCondition: any, count: number, excludeIds: any[]) => {
      if (count <= 0) return [];
      const tierMatch: Record<string, any> = { ...baseMatch, difficulty: diffCondition };
      if (excludeIds.length > 0) {
        // String + ObjectId forms, so retries skip rows already picked.
        tierMatch._id = { $nin: questionIdVariants(excludeIds) };
      }
      // Teacher-safe filtering happens after retrieval. Sampling only exactly
      // `count` records could therefore return 74/75 even when the database
      // contains more valid questions. Sample a bounded surplus and retry a
      // couple of times before reporting a genuine availability shortage.
      const safe: any[] = [];
      const seen = new Set<string>();
      for (let attempt = 0; attempt < 3 && safe.length < count; attempt += 1) {
        const needed = count - safe.length;
        const pipeline = [
          { $match: tierMatch },
          { $sample: { size: Math.min(240, Math.max(needed * 3, 20)) } },
        ];
        const sampled = await questionsCol.aggregate(pipeline).toArray();
        const safeSample = await keepTeacherSafeQuestions(db, sampled);
        safeSample.forEach((doc) => {
          const id = String(doc._id || doc.id);
          if (!seen.has(id) && safe.length < count) {
            seen.add(id);
            safe.push(doc);
          }
        });
      }
      return safe;
    };

    const collectedIds = new Set<string>();
    const allQuestions: any[] = [];

    // Levels match disjoint difficulty tiers, so they cannot pick the same
    // question and can be sampled in parallel (~0.7 s each on wide scopes).
    // Results are still appended in Easy → Moderate → Tough order.
    const levelDocs = await Promise.all(DIFFICULTY_LEVELS.map((level) =>
      sampleTier({ $in: levelTiers[level] }, levelTargets[level], [])));
    for (const docs of levelDocs) {
      docs.forEach((doc) => {
        const idStr = String(doc._id || doc.id);
        if (!collectedIds.has(idStr)) {
          collectedIds.add(idStr);
          allQuestions.push(doc);
        }
      });
    }

    // Never backfill a missing difficulty with another level. A 100% Tough
    // request must never contain Easy/Moderate records merely to hit the count.
    const deficit = totalCount - allQuestions.length;
    if (deficit > 1) {
      // Tell the teacher exactly which level is short so Paper Studio can
      // offer a one-click split that fits, instead of a generic failure.
      // If the count itself fails (e.g. maxTimeMS), still return the 422 with a
      // generic shortfall rather than turning it into a 500.
      const availability = await countAvailability().catch(() => null);
      const details = !availability ? '' : DIFFICULTY_LEVELS
        .filter((level) => availability.levels[level].available < availability.levels[level].needed)
        .map((level) => t('api.paper.shortfallLevel', {
          label: t(`paper.difficulty.label.${level}`),
          available: availability.levels[level].available,
          needed: availability.levels[level].needed,
        }))
        .join(', ');
      return NextResponse.json({
        success: false,
        error: t('api.paper.shortfall', { details: details || `${allQuestions.length}/${totalCount}` }),
        available: allQuestions.length,
        requested: totalCount,
        ...(availability ? { availability } : {}),
      }, { status: 422 });
    }

    // Format questions with default marks and numbering
    const formattedQuestions = allQuestions.map((q, idx) => ({
      ...q,
      orderIndex: idx + 1,
      marks: Number(marksPerQuestion) || 4,
      negative_marks: resolveQuestionNegativeMarks(q, negativeMarks),
    }));

    return NextResponse.json({
      success: true,
      totalGenerated: formattedQuestions.length,
      requestedCount: totalCount,
      partial: deficit === 1,
      warning: deficit === 1 ? `One matching question is not available for the exact difficulty split. ${formattedQuestions.length} matching questions are ready for review.` : undefined,
      available: formattedQuestions.length,
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
