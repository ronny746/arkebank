import type { QuestionItem, SavedPaper } from './paper';

export type ExamStatus = 'draft' | 'published' | 'closed';

export interface ExamSecurity {
  requireFullScreen: boolean;
  disableCopyPaste: boolean;
  maxTabSwitchesAllowed: number;
}

export interface OnlineExam {
  id: string;
  slug: string;
  title: string;
  description?: string;
  paperId?: string;
  paper: Pick<SavedPaper, 'title' | 'class_std' | 'subject' | 'timeAllowed' | 'totalMarks' | 'instructions'>;
  questions: QuestionItem[];
  status: ExamStatus;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  showResultsAfterSubmit: boolean;
  security: ExamSecurity;
  createdAt: string;
  updatedAt: string;
  /** Public route supplies this so closed exams can still expose an existing student's result lookup. */
  isAvailable?: boolean;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  sessionToken: string;
  student: { name: string; email: string; phone: string };
  answers: Record<string, string>;
  violations: { tabSwitches: number; fullScreenExits: number };
  currentQuestion?: number;
  startedAt: string;
  updatedAt?: string;
  submittedAt?: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  result?: {
    score: number;
    maxScore: number;
    percentage: number;
    totalCorrect: number;
    totalWrong: number;
    totalUnattempted: number;
    totalManualReview?: number;
  };
}
