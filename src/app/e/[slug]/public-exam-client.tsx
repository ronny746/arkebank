'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, Expand, Flag, LockKeyhole, ShieldCheck, Trash2, Trophy, XCircle } from 'lucide-react';
import MathRenderer from '@/components/MathRenderer';
import type { OnlineExam } from '@/types/exam';
import type { TenantBrand } from '@/lib/tenant';

type Stage = 'loading' | 'join' | 'exam' | 'done' | 'error';
type State = 'not_visited' | 'not_answered' | 'answered' | 'review' | 'answered_review';
type ResponseReview = {
  id: string;
  number: number;
  question: string;
  questionImage?: string;
  options: Array<{ key: string; text?: string; image?: string }>;
  selected: string | null;
  correct: string | null;
  solution: string;
  outcome: 'correct' | 'wrong' | 'unattempted' | 'manual_review';
  marks: number;
  negativeMarks: number;
};
type StudentResult = {
  score: number;
  maxScore: number;
  percentage: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  totalManualReview?: number;
  rank?: number;
  totalRanked?: number;
  responseReview?: ResponseReview[];
};
type AttemptSummary = {
  student: { name: string; email: string; phone: string };
  startedAt?: string;
  submittedAt?: string;
  status?: 'submitted' | 'auto_submitted';
};
const time = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const elapsedTime = (startedAt?: string, submittedAt?: string) => {
  if (!startedAt || !submittedAt) return '—';
  const seconds = Math.max(0, Math.floor((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

function AnswerValue({ option, fallback }: { option?: { key: string; text?: string; image?: string }; fallback: string }) {
  if (!option) return <b className="student-answer-value">{fallback}</b>;
  return <div className="student-answer-value"><b>{option.key.toUpperCase()}.</b>{option.text ? <MathRenderer content={option.text}/> : null}{option.image ? <img src={option.image} alt="Answer option"/> : null}</div>;
}

function StudentResultAnalysis({ result, attempt }: { result: StudentResult; attempt?: AttemptSummary | null }) {
  const outcomeCopy: Record<ResponseReview['outcome'], string> = { correct: 'Correct', wrong: 'Incorrect', unattempted: 'Not attempted', manual_review: 'Manual review' };
  return <div className="student-result-analysis">
    {attempt ? <section className="student-attempt-details" aria-label="Your exam attempt details">
      <div className="student-attempt-details-heading"><span>YOUR ATTEMPT</span><b>{attempt.status === 'auto_submitted' ? 'Auto-submitted' : 'Submitted'}</b></div>
      <dl>
        <div><dt>Student</dt><dd>{attempt.student.name}</dd></div>
        <div><dt>Email</dt><dd>{attempt.student.email}</dd></div>
        <div><dt>Mobile</dt><dd>{attempt.student.phone}</dd></div>
        <div><dt>Started</dt><dd>{dateTime(attempt.startedAt)}</dd></div>
        <div><dt>Submitted</dt><dd>{dateTime(attempt.submittedAt)}</dd></div>
        <div><dt>Time taken</dt><dd>{elapsedTime(attempt.startedAt, attempt.submittedAt)}</dd></div>
      </dl>
    </section> : null}
    <section className="student-result-hero">
      <div className="student-result-mark"><Trophy size={22}/><b>{result.score}</b><span>out of {result.maxScore} marks</span></div>
      <div className="student-result-metrics">
        <span><b>{result.percentage}%</b>Score</span>
        <span><b>#{result.rank || '—'}</b>{result.totalRanked ? `Rank of ${result.totalRanked}` : 'Rank'}</span>
        <span><b>{result.totalCorrect}</b>Correct</span>
        <span><b>{result.totalWrong}</b>Incorrect</span>
        <span><b>{result.totalUnattempted}</b>Unattempted</span>
      </div>
    </section>
    {result.totalManualReview ? <p className="student-result-note">{result.totalManualReview} response{result.totalManualReview > 1 ? 's need' : ' needs'} faculty review and are not included in the automatic score.</p> : null}
    {result.responseReview?.length ? <section className="student-review-list" aria-labelledby="student-review-title"><header><BarChart3 size={18}/><div><h2 id="student-review-title">Question-wise analysis</h2><p>Review your answer, the correct answer and the explanation.</p></div></header>{result.responseReview.map(review => {
      const chosen = review.options.find(option => option.key.toLowerCase() === review.selected?.toLowerCase());
      const correct = review.options.find(option => option.key.toLowerCase() === review.correct?.toLowerCase());
      return <article key={review.id} className={`student-review-card ${review.outcome}`}>
        <header><span>Q.{review.number}</span><b className={`student-outcome ${review.outcome}`}>{review.outcome === 'correct' ? <CheckCircle2 size={15}/> : review.outcome === 'wrong' ? <XCircle size={15}/> : null}{outcomeCopy[review.outcome]}</b><small>+{review.marks} / −{review.negativeMarks}</small></header>
        <MathRenderer content={review.question}/>{review.questionImage ? <img className="student-review-image" src={review.questionImage} alt={`Diagram for question ${review.number}`}/> : null}
        <div className="student-answer-compare"><div><span>Your answer</span><AnswerValue option={chosen} fallback={review.selected?.toUpperCase() || 'Not answered'}/></div><div><span>Correct answer</span><AnswerValue option={correct} fallback={review.correct?.toUpperCase() || 'Faculty review required'}/></div></div>
        {review.solution ? <details><summary>View solution</summary><MathRenderer content={review.solution}/></details> : null}
      </article>;
    })}</section> : null}
  </div>;
}

export default function PublicExamClient({ slug, brand }: { slug: string; brand: TenantBrand }) {
  const [stage, setStage] = useState<Stage>('loading'); const [exam, setExam] = useState<OnlineExam | null>(null); const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' }); const [attempt, setAttempt] = useState<{ id: string; token: string } | null>(null);
  const [index, setIndex] = useState(0); const [answers, setAnswers] = useState<Record<string, string>>({}); const [states, setStates] = useState<Record<string, State>>({}); const [seconds, setSeconds] = useState(0); const [violations, setViolations] = useState({ tabSwitches: 0, fullScreenExits: 0 }); const [result, setResult] = useState<StudentResult | null>(null); const [attemptSummary, setAttemptSummary] = useState<AttemptSummary | null>(null); const [submissionMessage, setSubmissionMessage] = useState(''); const [confirm, setConfirm] = useState(false);
  useEffect(() => { fetch(`/api/public/exams/${slug}`, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setExam(data.exam); setStage('join'); }).catch(reason => { setError(reason.message || 'Unable to load this exam.'); setStage('error'); }); }, [slug]);
  const submit = useCallback(async (auto = false) => { if (!attempt || !exam || stage === 'done') return; const response = await fetch(`/api/public/exams/${slug}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: attempt.id, sessionToken: attempt.token, answers, violations, autoSubmitted: auto }) }); const data = await response.json(); if (!response.ok) return setError(data.error || 'Submission failed.'); setResult(data.result || null); setAttemptSummary(data.attempt || null); setSubmissionMessage(data.result ? 'Your response and detailed analysis are ready.' : 'Your attempt has been securely recorded. Results will be shared by your faculty.'); setStage('done'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }, [answers, attempt, exam, slug, stage, violations]);
  useEffect(() => { if (stage !== 'exam') return; if (seconds <= 0) { const finish = window.setTimeout(() => { void submit(true); }, 0); return () => window.clearTimeout(finish); } const timer = window.setInterval(() => setSeconds(value => value - 1), 1000); return () => window.clearInterval(timer); }, [seconds, stage, submit]);
  useEffect(() => { if (stage !== 'exam' || !exam) return; const block = (event: Event) => event.preventDefault(); const hidden = () => { if (document.hidden) setViolations(value => ({ ...value, tabSwitches: value.tabSwitches + 1 })); }; const fullscreen = () => { if (!document.fullscreenElement) setViolations(value => ({ ...value, fullScreenExits: value.fullScreenExits + 1 })); }; document.addEventListener('visibilitychange', hidden); document.addEventListener('fullscreenchange', fullscreen); if (exam.security.disableCopyPaste) ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'].forEach(event => document.addEventListener(event, block)); return () => { document.removeEventListener('visibilitychange', hidden); document.removeEventListener('fullscreenchange', fullscreen); ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'].forEach(event => document.removeEventListener(event, block)); }; }, [exam, stage]);
  useEffect(() => {
    if (stage !== 'exam' || !attempt) return;
    const syncProgress = () => {
      void fetch(`/api/public/exams/${slug}/progress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sessionToken: attempt.token, answers, violations, currentQuestion: index }),
      });
    };
    syncProgress();
    const interval = window.setInterval(syncProgress, 10_000);
    return () => window.clearInterval(interval);
  }, [answers, attempt, index, slug, stage, violations]);
  useEffect(() => { if (stage === 'exam' && exam && violations.tabSwitches >= exam.security.maxTabSwitchesAllowed) { const finish = window.setTimeout(() => { void submit(true); }, 0); return () => window.clearTimeout(finish); } }, [exam, stage, submit, violations.tabSwitches]);
  const begin = async () => { const response = await fetch(`/api/public/exams/${slug}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) return setError(data.error); if (data.alreadySubmitted) { setResult(data.result || null); setAttemptSummary(data.attempt || null); setSubmissionMessage(data.message || 'Your submitted attempt was found.'); setStage('done'); return; } setAttempt({ id: data.attemptId, token: data.sessionToken }); setSeconds(data.durationMinutes * 60); if (exam?.security.requireFullScreen) await document.documentElement.requestFullscreen().catch(() => {}); setStage('exam'); };
  const question = exam?.questions[index]; const id = question ? String(question._id || question.id) : '';
  const go = (next: number) => { if (!exam) return; const q = exam.questions[next]; const nextId = String(q._id || q.id); setStates(previous => previous[nextId] ? previous : { ...previous, [nextId]: 'not_answered' }); setIndex(next); };
  const choose = (option: string) => { setAnswers(previous => ({ ...previous, [id]: option })); setStates(previous => ({ ...previous, [id]: previous[id] === 'review' || previous[id] === 'answered_review' ? 'answered_review' : 'answered' })); };
  const clear = () => { setAnswers(previous => { const next = { ...previous }; delete next[id]; return next; }); setStates(previous => ({ ...previous, [id]: 'not_answered' })); };
  const review = (next = false) => { if (!exam) return; setStates(previous => ({ ...previous, [id]: answers[id] ? 'answered_review' : 'review' })); if (next && index < exam.questions.length - 1) go(index + 1); };
  const saveNext = () => { if (!exam) return; setStates(previous => ({ ...previous, [id]: answers[id] ? 'answered' : 'not_answered' })); if (index < exam.questions.length - 1) go(index + 1); };
  const counts = useMemo(() => { const all = Object.values(states); return { unvisited: Math.max(0, (exam?.questions.length || 0) - all.length), unanswered: all.filter(item => item === 'not_answered').length, answered: all.filter(item => item === 'answered').length, review: all.filter(item => item === 'review' || item === 'answered_review').length }; }, [exam?.questions.length, states]);
  if (stage === 'loading') return <main className="exam-shell">Preparing secure examination…</main>;
  if (stage === 'error') return <main className="exam-shell"><section className="exam-message"><AlertTriangle/><h1>Exam unavailable</h1><p>{error}</p></section></main>;
  if (stage === 'done') return <main className="exam-shell exam-result-shell"><section className="exam-message student-result-message"><CheckCircle2/><h1>Response submitted</h1><p>{submissionMessage || 'Your attempt has been securely recorded.'}</p>{result ? <StudentResultAnalysis result={result} attempt={attemptSummary}/> : null}</section></main>;
  if (stage === 'join' && exam) return <main className="exam-shell"><section className="exam-join-card"><div className="public-exam-brand"><img src={brand.logoSrc} alt={`${brand.name} logo`}/><span>{brand.portalName}</span></div><div className="exam-security-mark"><ShieldCheck/> Secure assessment</div><h1>{exam.title}</h1><p>{exam.description || `${exam.paper.subject} · ${exam.questions.length} questions`}</p><div className="exam-meta"><span><Clock3/> {exam.durationMinutes} min</span><span><LockKeyhole/> Full screen protected</span></div><div className="exam-rules"><b>{exam.isAvailable === false ? 'Exam closed for new attempts' : 'Before you begin'}</b><p>{exam.isAvailable === false ? 'New attempts are closed. A student who has already submitted can still use the same details to view their result.' : 'Stay on this screen. Tab changes and fullscreen exits are recorded. Copying, pasting, printing, and right-click are disabled during the test.'}</p><p className="exam-return-note">Already submitted? Enter the same email and mobile number to open your result analysis.</p></div><div className="exam-registration-fields"><label>Full name<input autoComplete="name" placeholder="Enter your full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label><label>Email address<input type="email" autoComplete="email" placeholder="name@example.com" value={form.email} onChange={event => setForm({ ...form, name: event.target.value })}/></label><label>Phone number<input type="tel" autoComplete="tel" placeholder="Enter your mobile number" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label></div>{error && <p className="exam-error" role="alert">{error}</p>}<button className="exam-primary" onClick={begin}>{exam.isAvailable === false ? 'Open my result analysis' : <>Enter and start exam <Expand size={17}/></>}</button></section></main>;
  if (!exam || !question) return null;
  return <main className="nta-exam"><header className="nta-header"><div><span>{brand.portalName}</span><b>{exam.title}</b></div><strong><Clock3/> {time(seconds)}</strong></header><div className="nta-layout"><aside className="nta-palette"><div className="nta-candidate"><div><small>Candidate</small><b>{form.name}</b></div><div><small>Time left</small><strong>{time(seconds)}</strong></div></div><div className="nta-legend"><span><i className="palette-not-visited">{counts.unvisited}</i>Not visited</span><span><i className="palette-not-answered">{counts.unanswered}</i>Not answered</span><span><i className="palette-answered">{counts.answered}</i>Answered</span><span><i className="palette-review">{counts.review}</i>Marked for review</span></div><div className="nta-palette-title">Choose a question <small>{Object.keys(answers).length}/{exam.questions.length} answered</small></div><div className="nta-question-grid">{exam.questions.map((item, itemIndex) => { const itemId = String(item._id || item.id); return <button key={`${itemId}-${itemIndex}`} onClick={() => go(itemIndex)} className={`palette-${states[itemId] || 'not_visited'} ${index === itemIndex ? 'current' : ''}`}>{itemIndex + 1}</button>; })}</div><button className="nta-submit" onClick={() => setConfirm(true)}>Submit exam</button></aside><section className="nta-question-area"><div className="nta-question-head"><span>Question {index + 1} of {exam.questions.length}</span><b>+{question.marks || 4} / −{question.negative_marks || 1}</b></div><div className="nta-question-text"><MathRenderer content={question.question}/>{question.question_image && <img className="exam-image" src={question.question_image} alt="Question diagram"/>}</div>{(() => {
            const hasOptions = Array.isArray(question.options) && question.options.some(opt => (opt.text && opt.text.trim().length > 0) || (opt.image && opt.image.trim().length > 0));
            return hasOptions ? (
              <div className="nta-options">
                {question.options?.map(option => (
                  <button key={option.key} onClick={() => choose(option.key)} className={answers[id] === option.key ? 'selected' : ''}>
                    <span>{option.key.toUpperCase()}</span>
                    <MathRenderer content={option.text || ''} inline/>
                  </button>
                ))}
              </div>
            ) : (
              <div className="nta-numerical-box">
                <div className="nta-numerical-label">
                  <span>✍️ Numerical / Subjective Question (No Multiple Choice Options)</span>
                </div>
                <p className="nta-numerical-sub">
                  This question does not have MCQ options. Enter your numerical value, True/False, or text response below:
                </p>
                <div className="nta-numerical-input-wrap">
                  <input
                    type="text"
                    placeholder="Type your answer here..."
                    value={answers[id] || ''}
                    onChange={(e) => choose(e.target.value)}
                    className="nta-numerical-input"
                  />
                </div>
              </div>
            );
          })()}<footer className="nta-actions"><div><button className="nta-save" onClick={saveNext}>Save & next</button><button onClick={clear}><Trash2 size={14}/> Clear response</button><button className="nta-review" onClick={() => review()}><Flag size={14}/> Mark for review</button></div><div><button disabled={index === 0} onClick={() => go(index - 1)}>Previous</button><button disabled={index === exam.questions.length - 1} onClick={() => go(index + 1)}>Next</button></div></footer></section></div>{confirm && <div className="nta-confirm"><section><h2>Submit exam?</h2><p>You cannot change answers after submitting this test.</p><div><button onClick={() => setConfirm(false)}>Continue test</button><button className="nta-submit" onClick={() => void submit()}>Yes, submit</button></div></section></div>}</main>;
}
