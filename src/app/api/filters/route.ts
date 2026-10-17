import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { cached } from '@/lib/cache';
import { QUESTION_TYPE_OPTIONS, withQuestionType } from '@/lib/question-types';

export async function GET(req: Request) {
  try {
    // 1. Strict Token Verification: Block unauthenticated access to taxonomy & counts
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
    const class_std = searchParams.get('class_std');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const withQuestions = searchParams.get('withQuestions') === 'true';
    const lang = searchParams.get('lang');

    const cacheKey = `filters:${class_std || 'all'}:${subject || 'all'}:${topic || 'all'}:${withQuestions}:${lang || 'all'}`;

    // Cache filters response in Redis/in-memory for 15 minutes (900 seconds)
    const result = await cached(cacheKey, 900, async () => {
      const { db } = await connectToDatabase();
      const syllabusCol = db.collection('syllabus');
      const questionsCol = db.collection('questions');

      // 1. Paper Studio must not offer empty streams. The bank can show the
      // complete taxonomy, but generator choices must have usable records.
      const classQuestionScope: Record<string, unknown> = {};
      if (lang && lang !== 'all') classQuestionScope.lang = lang;
      const dynamicClasses = (withQuestions
        ? await questionsCol.distinct('class_std', classQuestionScope)
        : await syllabusCol.distinct('class_std')).filter(Boolean);
      const standardPriority = ['Class 9', 'Class 10', 'Class 11', 'Class 12', 'JM', 'JA', 'NEET', 'Competitive Exam'];
      const sortedClasses = dynamicClasses.sort((a, b) => {
        const idxA = standardPriority.indexOf(a);
        const idxB = standardPriority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      // 2. Fetch dynamic subjects
      const syllabusQuery: any = {};
      if (class_std && class_std !== 'all') {
        syllabusQuery.class_std = class_std;
      }
      const questionScope: Record<string, unknown> = {};
      if (class_std && class_std !== 'all') questionScope.class_std = class_std;
      if (lang && lang !== 'all') questionScope.lang = lang;
      const dynamicSubjects = (withQuestions
        ? await questionsCol.distinct('subject', questionScope)
        : await syllabusCol.distinct('subject', syllabusQuery)
      ).filter(Boolean).sort();

      // Show only formats that genuinely exist for the active class + subject.
      const typeScope: Record<string, unknown> = { ...questionScope };
      if (subject && subject !== 'all') typeScope.subject = subject;
      const typeCounts = await Promise.all(
        QUESTION_TYPE_OPTIONS.filter((item) => item.id !== 'all').map(async (item) => ({
          id: item.id,
          count: await questionsCol.countDocuments(withQuestionType(typeScope, item.id)),
        })),
      );
      const questionTypes = ['all', ...typeCounts.filter((item) => item.count > 0).map((item) => item.id)];

      // 3. Fetch dynamic topics/chapters and subtopics from precomputed syllabus
      let topics: string[] = [];
      let subTopics: string[] = [];

      if (class_std && class_std !== 'all' && subject && subject !== 'all') {
        const syllabusDoc = await syllabusCol.findOne({ class_std, subject });
        if (syllabusDoc && Array.isArray(syllabusDoc.chapters)) {
          topics = syllabusDoc.chapters.map((ch: any) => ch.topic_name).filter(Boolean).sort();

          if (topic && topic !== 'all') {
            const matchingChapter = syllabusDoc.chapters.find((ch: any) => ch.topic_name === topic);
            if (matchingChapter && Array.isArray(matchingChapter.sub_topics)) {
              subTopics = matchingChapter.sub_topics.map((st: any) => st.sub_topic_name).filter(Boolean).sort();
            }
          }
        }
      } else if (class_std && class_std !== 'all') {
        const docs = await syllabusCol.find({ class_std }).toArray();
        const topicSet = new Set<string>();
        docs.forEach((doc: any) => {
          if (doc.chapters) {
            doc.chapters.forEach((ch: any) => {
              if (ch.topic_name) topicSet.add(ch.topic_name);
            });
          }
        });
        topics = Array.from(topicSet).sort();
      } else if (subject && subject !== 'all') {
        const docs = await syllabusCol.find({ subject }).toArray();
        const topicSet = new Set<string>();
        docs.forEach((doc: any) => {
          if (doc.chapters) {
            doc.chapters.forEach((ch: any) => {
              if (ch.topic_name) topicSet.add(ch.topic_name);
            });
          }
        });
        topics = Array.from(topicSet).sort();
      }

      // Paper Studio asks for only usable chapters. Syllabus can contain chapters
      // before question ingestion, so remove those empty taxonomy entries here.
      if (withQuestions && class_std && class_std !== 'all' && subject && subject !== 'all') {
        const topicScope: Record<string, unknown> = { ...questionScope, subject };
        const questionTopics = await questionsCol.distinct('topic', topicScope);
        const usableTopics = new Set(questionTopics.filter(Boolean));
        topics = topics.filter((item) => usableTopics.has(item));
      }

      // 4. Fetch distinct years (sorted descending)
      const rawYears = await questionsCol.distinct('year');
      const validYears = rawYears
        .filter((y: any) => typeof y === 'number' && y > 1990)
        .sort((a: number, b: number) => b - a);

      // Dynamic total question count using fast metadata
      const totalQuestions = await questionsCol.estimatedDocumentCount();

      return {
        classes: sortedClasses,
        subjects: dynamicSubjects,
        questionTypes,
        topics,
        subTopics,
        years: validYears,
        totalQuestions,
        difficulties: [
          { value: 'all', label: 'All Difficulties' },
          { value: '0', label: 'Tier 0 - Basic' },
          { value: '1', label: 'Tier 1 - Easy' },
          { value: '2', label: 'Tier 2 - Medium' },
          { value: '3', label: 'Tier 3 - Hard' },
          { value: '4', label: 'Tier 4 - Expert' },
        ],
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Taxonomy Filters API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}
