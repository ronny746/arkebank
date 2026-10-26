import type { QuestionItem } from '@/types/paper';

export type ResponseOutcome = 'correct' | 'wrong' | 'unattempted' | 'manual_review';

export type ResponseReview = {
  id: string;
  number: number;
  question: string;
  questionImage?: string;
  options: Array<{ key: string; text?: string; image?: string }>;
  selected: string | null;
  correct: string | null;
  solution: string;
  outcome: ResponseOutcome;
  marks: number;
  negativeMarks: number;
};

export type ExamResult = {
  score: number;
  maxScore: number;
  percentage: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  totalManualReview: number;
};

const questionId = (question: QuestionItem, index: number) => String(question._id || question.id || index);
const asNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/** One scoring source for the student outcome and faculty tracking views. */
export function assessAttempt(questions: QuestionItem[], answers: Record<string, string>) {
  let score = 0;
  let maxScore = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalManualReview = 0;

  const responseReview: ResponseReview[] = questions.map((question, index) => {
    const id = questionId(question, index);
    const selected = String(answers[id] || '').trim().toLowerCase();
    const correct = String(question.correct_option || question.correct_answer || '').trim().toLowerCase();
    const marks = Math.max(0, asNumber(question.marks, 4));
    const negativeMarks = Math.max(0, asNumber(question.negative_marks, 1));
    const hasObjectiveOptions = Array.isArray(question.options) && question.options.some(option => Boolean(option.text || option.image));
    const isAutoGradable = hasObjectiveOptions && Boolean(correct);
    maxScore += marks;

    let outcome: ResponseOutcome = 'unattempted';
    if (!selected) {
      totalUnattempted += 1;
    } else if (!isAutoGradable) {
      outcome = 'manual_review';
      totalManualReview += 1;
    } else if (selected === correct) {
      outcome = 'correct';
      totalCorrect += 1;
      score += marks;
    } else {
      outcome = 'wrong';
      totalWrong += 1;
      score -= negativeMarks;
    }

    return {
      id,
      number: index + 1,
      question: question.question || `Question ${index + 1}`,
      questionImage: question.question_image,
      options: question.options || [],
      selected: selected || null,
      correct: correct || null,
      solution: question.solution || '',
      outcome,
      marks,
      negativeMarks,
    };
  });

  return {
    result: {
      score,
      maxScore,
      percentage: maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0,
      totalCorrect,
      totalWrong,
      totalUnattempted,
      totalManualReview,
    } satisfies ExamResult,
    responseReview,
  };
}

export function calculateRank(score: number, submittedScores: number[]) {
  return {
    rank: submittedScores.filter(item => item > score).length + 1,
    totalRanked: submittedScores.length,
  };
}
