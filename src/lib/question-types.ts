export const QUESTION_TYPE_OPTIONS = [
  { id: 'all', label: '🔀 Mix All Types', shortLabel: 'All', title: 'Use every available question format' },
  { id: 'mcq', label: '🔘 MCQ Only', shortLabel: 'MCQs', title: 'Multiple-choice questions' },
  { id: 'subjective', label: '✍️ Subjective / Theory', shortLabel: 'Subjective', title: 'Descriptive and theory questions' },
  { id: 'numerical', label: '🔢 Numerical / Integer', shortLabel: 'Numerical', title: 'Numerical and integer-answer questions' },
  { id: 'true_false', label: '⚖️ True / False', shortLabel: 'True/False', title: 'True-or-false statements' },
] as const;

export type QuestionType = (typeof QUESTION_TYPE_OPTIONS)[number]['id'];

/** A single source of truth for question-type availability and filtering. */
export function getQuestionTypeMatch(questionType: QuestionType | string | null | undefined): Record<string, unknown> {
  if (questionType === 'mcq') return { 'options.0.text': { $exists: true, $ne: '' } };

  if (questionType === 'subjective') {
    return {
      $and: [
        { $or: [{ 'options.0.text': { $exists: false } }, { 'options.0.text': '' }] },
        { $or: [{ correct_answer: { $exists: false } }, { correct_answer: '' }] },
      ],
    };
  }

  if (questionType === 'numerical') {
    return {
      $and: [
        { $or: [{ 'options.0.text': { $exists: false } }, { 'options.0.text': '' }] },
        { correct_answer: { $exists: true, $ne: '' } },
      ],
    };
  }

  if (questionType === 'true_false') {
    return {
      $or: [
        { question: { $regex: 'true or false|सत्य या असत्य|सत्य/असत्य', $options: 'i' } },
        { 'options.0.text': { $regex: '^true$|^false$|^सत्य$|^असत्य$', $options: 'i' } },
      ],
    };
  }

  return {};
}

export function withQuestionType<T extends Record<string, unknown>>(baseMatch: T, questionType: QuestionType | string | null | undefined): T & Record<string, unknown> {
  const typeMatch = getQuestionTypeMatch(questionType);
  return Object.keys(typeMatch).length ? { ...baseMatch, $and: [...(Array.isArray(baseMatch.$and) ? baseMatch.$and : []), typeMatch] } : baseMatch;
}
