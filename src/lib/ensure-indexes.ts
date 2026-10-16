import { Db } from 'mongodb';

let indexesEnsured = false;

/**
 * Ensures all high-speed production indexes are in place across collections.
 * Runs in the background with zero blocking overhead on requests.
 */
export async function ensureDatabaseIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  try {
    const qCol = db.collection('questions');
    const pCol = db.collection('papers');
    const eCol = db.collection('exams');
    const aCol = db.collection('exam_attempts');
    const sCol = db.collection('syllabus');

    // 1. Questions collection
    await Promise.allSettled([
      qCol.createIndex({ id: 1, lang: 1 }, { background: true, name: 'idx_id_lang' }),
      qCol.createIndex({ subject: 1, topic: 1, lang: 1, difficulty: 1 }, { background: true, name: 'idx_sub_top_lang_diff' }),
      qCol.createIndex({ class_std: 1, subject: 1, topic: 1, difficulty: 1, lang: 1 }, { background: true, name: 'idx_cls_sub_top_diff_lang' }),
      qCol.createIndex({ subject: 1, lang: 1 }, { background: true, name: 'idx_sub_lang' }),
      qCol.createIndex({ year: -1, subject: 1 }, { background: true, name: 'idx_year_sub' }),
      qCol.createIndex({ rand_id: 1, lang: 1 }, { background: true, name: 'idx_rand_lang' }),

      // 2. Papers collection (Scalable to unlimited papers)
      pCol.createIndex({ id: 1 }, { unique: true, background: true, name: 'idx_paper_id' }),
      pCol.createIndex({ updatedAt: -1 }, { background: true, name: 'idx_paper_updatedAt' }),
      pCol.createIndex({ createdAt: -1 }, { background: true, name: 'idx_paper_createdAt' }),
      pCol.createIndex({ class_std: 1, subject: 1 }, { background: true, name: 'idx_paper_cls_sub' }),

      // 3. Exams collection (Public & Admin)
      eCol.createIndex({ slug: 1 }, { unique: true, background: true, name: 'idx_exam_slug' }),
      eCol.createIndex({ id: 1 }, { unique: true, background: true, name: 'idx_exam_id' }),
      eCol.createIndex({ paperId: 1 }, { background: true, name: 'idx_exam_paperId' }),
      eCol.createIndex({ status: 1, createdAt: -1 }, { background: true, name: 'idx_exam_status_created' }),

      // 4. Exam attempts collection
      aCol.createIndex({ sessionToken: 1 }, { unique: true, background: true, name: 'idx_attempt_token' }),
      aCol.createIndex({ examId: 1, studentEmail: 1 }, { background: true, name: 'idx_attempt_exam_email' }),
      aCol.createIndex({ examId: 1, createdAt: -1 }, { background: true, name: 'idx_attempt_exam_created' }),

      // 5. Syllabus collection
      sCol.createIndex({ class_std: 1, subject: 1, topic: 1 }, { background: true, name: 'idx_syllabus_cls_sub_top' }),
    ]);

    console.log('⚡ Production MongoDB indexes verified and active.');
  } catch (err) {
    console.warn('Index verification notice:', err);
  }
}
