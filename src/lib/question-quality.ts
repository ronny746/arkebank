import type { Db } from 'mongodb';

type QuestionLike = {
  _id?: unknown;
  id?: unknown;
  question?: unknown;
  solution?: unknown;
  options?: Array<{ text?: unknown }>;
};

const htmlTagPattern = /<\/?(?:p|div|span|img|script|style|table|tr|td|iframe|html|body|svg)\b/i;
const rawLatexPattern = /\\(?:begin|end|left|right|frac|sqrt|text|mathrm|mathbf|omega|alpha|beta|gamma)\b/;
const mathDelimiterPattern = /\$\$[\s\S]*?\$\$|\$[^$\n\r]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/;

function decoded(value: unknown) {
  return String(value || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .trim();
}

/**
 * Database imports can contain source HTML or undelimited LaTex. Those records
 * cannot be reviewed safely by a teacher, so keep them out of faculty views
 * until an administrator corrects their source formatting.
 */
export function getTeacherVisibleQuestionIssue(question: QuestionLike): string | null {
  const fields: Array<[string, string]> = [
    ['question', decoded(question.question)],
    ['solution', decoded(question.solution)],
    ...(question.options || []).map((option, index) => [`option ${index + 1}`, decoded(option?.text)] as [string, string]),
  ];

  for (const [field, value] of fields) {
    if (!value) continue;
    if (htmlTagPattern.test(value) || /```/.test(value)) return `${field} contains raw HTML or source-code markup`;
    if (rawLatexPattern.test(value) && !mathDelimiterPattern.test(value)) return `${field} contains undelimited LaTeX source`;
  }
  return null;
}

export async function keepTeacherSafeQuestions<T extends QuestionLike>(db: Db, questions: T[]): Promise<T[]> {
  const unsafe = questions
    .map((question) => ({ question, issue: getTeacherVisibleQuestionIssue(question) }))
    .filter((item): item is { question: T; issue: string } => Boolean(item.issue));

  if (unsafe.length) {
    const now = new Date();
    await Promise.all(unsafe.map(({ question, issue }) => db.collection('question_quality_flags').updateOne(
      { questionId: String(question._id || question.id) },
      {
        $set: {
          questionId: String(question._id || question.id),
          questionNumericId: typeof question.id === 'number' ? question.id : null,
          reason: issue,
          status: 'open',
          lastSeenAt: now,
        },
        $setOnInsert: { createdAt: now, source: 'faculty-question-safety' },
      },
      { upsert: true },
    )));
  }

  return questions.filter((question) => !getTeacherVisibleQuestionIssue(question));
}
