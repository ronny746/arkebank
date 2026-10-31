export const QUESTION_TYPE_OPTIONS = [
  { id: 'all', label: '🔀 Mix All Types', shortLabel: 'All', title: 'Use every available question format' },
  { id: 'mcq', label: '🔘 MCQ Only', shortLabel: 'MCQs', title: 'Multiple-choice questions' },
  { id: 'subjective', label: '✍️ Subjective / Theory', shortLabel: 'Subjective', title: 'Descriptive and theory questions' },
  { id: 'numerical', label: '🔢 Numerical / Integer', shortLabel: 'Numerical', title: 'Numerical and integer-answer questions' },
  { id: 'true_false', label: '⚖️ True / False', shortLabel: 'True/False', title: 'True-or-false statements' },
] as const;

export type QuestionType = (typeof QUESTION_TYPE_OPTIONS)[number]['id'];

type QuestionForScoring = {
  question?: unknown;
  options?: Array<{ text?: unknown; image?: unknown }>;
  correct_answer?: unknown;
  correct_option?: unknown;
};

/** True/false and descriptive responses must never receive an MCQ penalty. */
export function resolveQuestionNegativeMarks(question: QuestionForScoring, requestedNegativeMarks: unknown): number {
  const choices = Array.isArray(question.options) ? question.options : [];
  const optionText = choices.map((option) => String(option?.text ?? '').trim().toLowerCase()).filter(Boolean);
  const hasOptions = choices.some((option) => Boolean(String(option?.text ?? '').trim() || String(option?.image ?? '').trim()));
  const isTrueFalse = /true\s*(?:or|\/)\s*false|सत्य\s*(?:या|\/)\s*असत्य/i.test(String(question.question ?? ''))
    || (optionText.length > 0 && optionText.every((value) => ['true', 'false', 'सत्य', 'असत्य'].includes(value)));
  const isSubjective = !hasOptions && !String(question.correct_answer ?? '').trim() && !String(question.correct_option ?? '').trim();
  if (isTrueFalse || isSubjective) return 0;
  const parsed = Number(requestedNegativeMarks);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

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
