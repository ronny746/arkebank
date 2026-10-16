export interface OptionItem {
  key: string;
  text?: string;
  image?: string;
}

export interface QuestionExam {
  name?: string;
  que_year?: {
    name?: string;
    year?: number;
  };
}

export interface QuestionItem {
  _id: string;
  id: number;
  class_std: string;
  subject: string;
  topic?: string;
  sub_topic?: string;
  difficulty?: string | number;
  lang?: string;
  year?: number;
  question: string;
  question_image?: string;
  options?: OptionItem[];
  correct_option?: string;
  correct_answer?: string;
  solution?: string;
  solution_image?: string;
  marks?: number;
  negative_marks?: number;
  section?: string;
}

export interface PaperSection {
  id: string;
  name: string;
  description?: string;
  marksPerQuestion: number;
  negativeMarks: number;
}

export interface PaperMetadata {
  id?: string;
  title: string;
  instituteName: string;
  class_std: string;
  subject: string;
  timeAllowed: string;
  totalMarks: number;
  date?: string;
  instructions: string[];
  watermarkText?: string;
  showWatermark?: boolean;
}

export interface PaperBlueprintConfig {
  title: string;
  instituteName: string;
  class_std: string;
  subject: string;
  topics: string[];
  totalQuestions: number;
  preset: 'balanced' | 'foundation' | 'advanced' | 'jee_main' | 'neet' | 'custom';
  difficultyDistribution: {
    easy: number; // percentage (0-100)
    medium: number; // percentage (0-100)
    hard: number; // percentage (0-100)
  };
  lang: 'all' | 'en' | 'hi';
  hasImageOnly: boolean;
  pyqOnly: boolean;
  timeAllowed: string;
  marksPerQuestion: number;
  negativeMarks: number;
  instructions: string[];
}

export interface SavedPaper {
  id: string;
  title: string;
  instituteName: string;
  class_std: string;
  subject: string;
  timeAllowed: string;
  totalMarks: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
  questions: QuestionItem[];
  instructions: string[];
  sections?: PaperSection[];
  watermarkText?: string;
  showWatermark?: boolean;
}
