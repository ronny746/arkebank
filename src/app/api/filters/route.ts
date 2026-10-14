import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const class_std = searchParams.get('class_std');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');

    const { db } = await connectToDatabase();
    const syllabusCol = db.collection('syllabus');
    const questionsCol = db.collection('questions');

    // 1. Fetch dynamic classes from syllabus / questions
    const dynamicClasses = await syllabusCol.distinct('class_std');
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
    const dynamicSubjects = (await syllabusCol.distinct('subject', syllabusQuery)).filter(Boolean).sort();

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

    // 4. Fetch distinct years (sorted descending)
    const rawYears = await questionsCol.distinct('year');
    const validYears = rawYears
      .filter((y: any) => typeof y === 'number' && y > 1990)
      .sort((a: number, b: number) => b - a);

    // Dynamic total question count
    const totalQuestions = await questionsCol.estimatedDocumentCount();

    return NextResponse.json({
      classes: sortedClasses,
      subjects: dynamicSubjects,
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
        { value: '4', label: 'Tier 4 - Expert' }
      ],
      languages: [
        { value: 'all', label: 'All Languages' },
        { value: 'en', label: 'English (en)' },
        { value: 'hi', label: 'Hindi (hi)' }
      ]
    });
  } catch (error: any) {
    console.error('Filter error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
