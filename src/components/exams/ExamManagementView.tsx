'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Clock3, Copy, Download, Radio, RefreshCw, ShieldAlert, Users, ExternalLink, Globe, Trash2, X } from 'lucide-react';
import { getPublicExamUrl } from '@/lib/public-url';
import type { OnlineExam } from '@/types/exam';
import MathRenderer from '@/components/MathRenderer';

type ManagedExam = OnlineExam & { attemptCount: number; liveCount: number; submittedCount: number; questionCount: number };
type Attempt = {
  id: string;
  student: { name: string; email: string };
  status: string;
  startedAt: string;
  updatedAt?: string;
  submittedAt?: string;
  currentQuestion?: number;
  answers?: Record<string, string>;
  violations?: { tabSwitches?: number; fullScreenExits?: number };
  result?: { score?: number; maxScore?: number; percentage?: number; rank?: number; totalRanked?: number; totalCorrect?: number; totalWrong?: number; totalUnattempted?: number; totalManualReview?: number };
  responseReview?: Array<{ id: string; number: number; question: string; questionImage?: string; options: Array<{ key: string; text?: string; image?: string }>; selected: string | null; correct: string | null; solution: string; outcome: 'correct' | 'wrong' | 'unattempted' | 'manual_review'; marks: number; negativeMarks: number }>;
};
type Detail = { summary: { total: number; live: number; submitted: number; averageScore: number; violations: number }; attempts: Attempt[] };
type View = 'live' | 'results';

const statusLabel = (status: string) => status.replaceAll('_', ' ');
const timestamp = (value?: string) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const ChoiceValue = ({ option, fallback }: { option?: { key: string; text?: string; image?: string }; fallback: string }) => option
  ? <div className="faculty-answer-value"><b>{option.key.toUpperCase()}.</b>{option.text ? <MathRenderer content={option.text}/> : null}{option.image ? <img src={option.image} alt="Answer option"/> : null}</div>
  : <b className="faculty-answer-value">{fallback}</b>;
const downloadResults = (title: string, attempts: Attempt[]) => {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows: Array<Array<string | number>> = [['Student', 'Email', 'Status', 'Score', 'Correct', 'Wrong', 'Unattempted', 'Tab switches', 'Fullscreen exits', 'Submitted at']];
  attempts.forEach(attempt => rows.push([attempt.student.name, attempt.student.email, statusLabel(attempt.status), attempt.result?.score ?? '', attempt.result?.totalCorrect ?? '', attempt.result?.totalWrong ?? '', attempt.result?.totalUnattempted ?? '', attempt.violations?.tabSwitches ?? 0, attempt.violations?.fullScreenExits ?? 0, attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-IN') : '']));
  const file = new Blob([rows.map(row => row.map(quote).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file); const link = document.createElement('a');
  link.href = url; link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'exam'}-results.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};

export default function ExamManagementView({ onBack, showToast }: { onBack: () => void; showToast: (message: string) => void }) {
  const [exams, setExams] = useState<ManagedExam[]>([]);
  const [active, setActive] = useState<ManagedExam | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('live');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedExam | null>(null);
  const [deleting, setDeleting] = useState(false);
  const headers = (): Record<string, string> => { const token = localStorage.getItem('arke_token'); return token ? { Authorization: `Bearer ${token}` } : {}; };
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/exams', { headers: headers(), credentials: 'include' }); const data = await response.json();
      if (!response.ok) throw new Error(data.error); setExams(data.exams);
      if (active) setActive(data.exams.find((exam: ManagedExam) => exam.id === active.id) || null);
    } catch (reason) { showToast(reason instanceof Error ? reason.message : 'Could not load exams.'); } finally { setLoading(false); }
  };
  const loadDetail = async (exam: ManagedExam, preserveView = true) => {
    try {
      const response = await fetch(`/api/exams/${exam.id}/analysis`, { headers: headers(), credentials: 'include' }); const data = await response.json();
      if (!response.ok) throw new Error(data.error); setDetail({ summary: data.summary, attempts: data.attempts });
      if (!preserveView) setView('live');
    } catch (reason) { showToast(reason instanceof Error ? reason.message : 'Could not load exam activity.'); }
  };
  const open = async (exam: ManagedExam) => { setActive(exam); setDetail(null); setSelectedAttemptId(null); await loadDetail(exam, false); };
  useEffect(() => { const initialLoad = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(initialLoad); // Load once on workspace entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!active) return;
    const refresh = window.setInterval(() => { void loadDetail(active); }, 10_000);
    return () => window.clearInterval(refresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);
  const deleteExam = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: headers(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete exam');
      }

      setExams(prev => prev.filter(e => e.id !== deleteTarget.id && e.slug !== deleteTarget.id));
      if (active && (active.id === deleteTarget.id || active.slug === deleteTarget.id)) {
        setActive(null);
        setDetail(null);
      }
      setDeleteTarget(null);
      showToast('Exam deleted successfully.');
    } catch (err: any) {
      showToast(err.message || 'Could not delete exam.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteDialog = deleteTarget ? <div className="exam-delete-dialog-backdrop" role="presentation">
    <section className="exam-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-exam-title" aria-describedby="delete-exam-description">
      <button className="exam-delete-dialog-close" type="button" aria-label="Close delete confirmation" disabled={deleting} onClick={() => setDeleteTarget(null)}><X size={18}/></button>
      <div className="exam-delete-dialog-icon"><AlertTriangle size={22}/></div>
      <p className="dashboard-eyebrow">PERMANENT ACTION</p>
      <h2 id="delete-exam-title">Delete this exam?</h2>
      <p id="delete-exam-description"><strong>{deleteTarget.title}</strong> will be removed permanently, along with <strong>{deleteTarget.attemptCount} candidate {deleteTarget.attemptCount === 1 ? 'attempt' : 'attempts'}</strong> and all recorded responses.</p>
      <div className="exam-delete-dialog-summary"><span>{deleteTarget.questionCount} questions</span><span>{deleteTarget.liveCount} live now</span><span>{deleteTarget.submittedCount} submitted</span></div>
      <div className="exam-delete-dialog-actions"><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Keep exam</button><button type="button" className="exam-delete-confirm" disabled={deleting} onClick={() => void deleteExam()}>{deleting ? 'Deleting…' : 'Delete permanently'}</button></div>
    </section>
  </div> : null;

  const copy = async (slug: string) => {
    const liveUrl = getPublicExamUrl(slug);
    await navigator.clipboard.writeText(liveUrl);
    showToast('Student exam link copied.');
  };

  if (active) {
    const completed = detail?.attempts.filter(attempt => attempt.status === 'submitted' || attempt.status === 'auto_submitted') || [];
    const selectedAttempt = completed.find(attempt => attempt.id === selectedAttemptId) || null;
    return <><main className="exam-console">
      <button className="workspace-back" onClick={() => { setActive(null); setDetail(null); }}><ArrowLeft size={16}/> All exams</button>
      <div className="exam-console-heading">
        <div><span className="dashboard-eyebrow">LIVE EXAM CONTROL</span><h1>{active.title}</h1><p>{active.paper.class_std} · {active.paper.subject} · {active.questionCount} questions · refreshes every 10 seconds</p></div>
        <div className="console-head-actions"><button className="workspace-back" onClick={() => void loadDetail(active)}><RefreshCw size={15}/> Refresh now</button><button className="exam-copy-link" onClick={() => void copy(active.slug)}><Copy size={15}/> Copy student link</button><a className="exam-open-link" href={getPublicExamUrl(active.slug)} target="_blank" rel="noreferrer" title="Open live student test page"><ExternalLink size={15}/> Open live test</a><button className="exam-delete-btn" onClick={() => setDeleteTarget(active)} title="Delete exam"><Trash2 size={15}/> Delete exam</button></div>
      </div>
      {!detail ? <p className="console-loading">Loading exam control room…</p> : <>
        <section className="exam-live-stats">
          <div><Radio/><b>{detail.summary.live}</b><span>Live now</span></div><div><Users/><b>{detail.summary.total}</b><span>Registered</span></div><div><CheckCircle2/><b>{detail.summary.submitted}</b><span>Submitted</span></div><div><BarChart3/><b>{detail.summary.averageScore}</b><span>Average score</span></div><div><ShieldAlert/><b>{detail.summary.violations}</b><span>Security events</span></div>
        </section>
        <div className="exam-view-tabs" role="tablist" aria-label="Exam monitoring views"><button role="tab" aria-selected={view === 'live'} className={view === 'live' ? 'active' : ''} onClick={() => setView('live')}><Activity size={16}/> Live activity</button><button role="tab" aria-selected={view === 'results'} className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}><BarChart3 size={16}/> Results & analysis ({completed.length})</button></div>
        {view === 'live' ? <section className="exam-activity-panel"><header><div><h2><Activity size={18}/> Candidate activity</h2><p>Answers, active question and security events update automatically every 10 seconds.</p></div><button onClick={() => void loadDetail(active)}><RefreshCw size={15}/> Refresh</button></header>{detail.attempts.length === 0 ? <div className="exam-empty">No student has opened this exam yet. Share the student link to begin.</div> : <div className="candidate-table">{detail.attempts.map(attempt => { const events = (attempt.violations?.tabSwitches || 0) + (attempt.violations?.fullScreenExits || 0); const answered = Object.keys(attempt.answers || {}).length; return <div key={attempt.id} className="candidate-row"><div className="candidate-avatar">{attempt.student.name.slice(0, 1).toUpperCase()}</div><div><b>{attempt.student.name}</b><small>{attempt.student.email}</small></div><span className={`candidate-status ${attempt.status}`}>{statusLabel(attempt.status)}</span><span>{answered}/{active.questionCount} answered <small>Question {(attempt.currentQuestion || 0) + 1}</small></span><span>{attempt.status === 'in_progress' ? `Seen ${timestamp(attempt.updatedAt || attempt.startedAt)}` : `Score ${attempt.result?.score ?? '—'}`}</span><span className={events ? 'event-alert' : ''}>{events ? `${events} alert${events > 1 ? 's' : ''}` : 'Clear'}</span></div>; })}</div>}</section> : <section className="exam-results-panel"><header><div><h2>Submission results</h2><p>Open a student to see every response, the correct answer and its solution.</p></div><button className="workspace-back" disabled={!completed.length} onClick={() => downloadResults(active.title, completed)}><Download size={15}/> Export CSV</button></header>{completed.length === 0 ? <div className="exam-empty">Results will appear here after students submit the examination.</div> : <><div className="exam-results-scroll"><table><thead><tr><th>Rank</th><th>Student</th><th>Status</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Unattempted</th><th>Security</th><th>Submitted</th><th><span className="sr-only">Open analysis</span></th></tr></thead><tbody>{completed.map(attempt => { const events = (attempt.violations?.tabSwitches || 0) + (attempt.violations?.fullScreenExits || 0); const isSelected = selectedAttemptId === attempt.id; return <tr key={attempt.id} className={isSelected ? 'is-selected' : ''}><td><b>#{attempt.result?.rank ?? '—'}</b><small>{attempt.result?.totalRanked ? `of ${attempt.result.totalRanked}` : ''}</small></td><td><b>{attempt.student.name}</b><small>{attempt.student.email}</small></td><td><span className={`candidate-status ${attempt.status}`}>{statusLabel(attempt.status)}</span></td><td><b>{attempt.result?.score ?? '—'}</b><small>{attempt.result?.percentage ?? '—'}%</small></td><td>{attempt.result?.totalCorrect ?? '—'}</td><td>{attempt.result?.totalWrong ?? '—'}</td><td>{attempt.result?.totalUnattempted ?? '—'}</td><td className={events ? 'event-alert' : ''}>{events ? `${events} alerts` : 'Clear'}</td><td>{timestamp(attempt.submittedAt)}</td><td><button className="exam-analysis-open" type="button" aria-expanded={isSelected} onClick={() => setSelectedAttemptId(isSelected ? null : attempt.id)}>{isSelected ? 'Close' : 'View analysis'}</button></td></tr>; })}</tbody></table></div>{selectedAttempt ? <section className="faculty-attempt-analysis" aria-labelledby="faculty-analysis-title"><header><div><span className="dashboard-eyebrow">STUDENT RESPONSE ANALYSIS</span><h2 id="faculty-analysis-title">{selectedAttempt.student.name}</h2><p>{selectedAttempt.result?.score ?? 0}/{selectedAttempt.result?.maxScore ?? 0} marks · Rank #{selectedAttempt.result?.rank ?? '—'} · {selectedAttempt.result?.percentage ?? 0}%</p></div><button type="button" className="workspace-back" onClick={() => setSelectedAttemptId(null)}>Close analysis</button></header><div className="faculty-analysis-summary"><span><b>{selectedAttempt.result?.totalCorrect ?? 0}</b>Correct</span><span><b>{selectedAttempt.result?.totalWrong ?? 0}</b>Incorrect</span><span><b>{selectedAttempt.result?.totalUnattempted ?? 0}</b>Unattempted</span><span><b>{selectedAttempt.result?.totalManualReview ?? 0}</b>Manual review</span></div><div className="faculty-review-list">{selectedAttempt.responseReview?.map(review => { const chosen = review.options.find(option => option.key.toLowerCase() === review.selected?.toLowerCase()); const correct = review.options.find(option => option.key.toLowerCase() === review.correct?.toLowerCase()); return <article key={review.id} className={`faculty-review-card ${review.outcome}`}><header><b>Q.{review.number}</b><span className={`student-outcome ${review.outcome}`}>{review.outcome.replace('_', ' ')}</span><small>+{review.marks} / −{review.negativeMarks}</small></header><MathRenderer content={review.question}/>{review.questionImage ? <img src={review.questionImage} alt={`Question ${review.number} diagram`} /> : null}<div className="faculty-answer-compare"><p><span>Student answer</span><ChoiceValue option={chosen} fallback={review.selected?.toUpperCase() || 'Not answered'}/></p><p><span>Correct answer</span><ChoiceValue option={correct} fallback={review.correct?.toUpperCase() || 'Faculty review required'}/></p></div>{review.solution ? <details><summary>View solution</summary><MathRenderer content={review.solution}/></details> : null}</article>; })}</div></section> : null}</>}</section>}
      </>}
    </main>{deleteDialog}</>;
  }

  return <><main className="exam-console"><div className="exam-console-heading"><div><span className="dashboard-eyebrow">ASSESSMENT DELIVERY</span><h1>Exams & live tracking</h1><p>Publish student links, monitor every live attempt and review outcomes in one place.</p></div><div className="console-head-actions"><button className="workspace-back" onClick={onBack}><ArrowLeft size={16}/> Dashboard</button><button className="exam-copy-link" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></div>{loading ? <p className="console-loading">Loading examinations…</p> : exams.length === 0 ? <div className="exam-empty">No exams yet. Generate a paper, then choose “Create Exam” to publish its student link.</div> : <section className="exam-list-grid">{exams.map(exam => <article key={exam.id} className="exam-list-card"><header><span className={exam.liveCount ? 'live-badge' : 'exam-state'}>{exam.liveCount ? `${exam.liveCount} live` : exam.status}</span><div className="exam-card-header-right"><span>{new Date(exam.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span><button type="button" onClick={() => setDeleteTarget(exam)} className="btn-del-exam-card" title="Delete exam"><Trash2 size={14}/></button></div></header><h2>{exam.title}</h2><p>{exam.paper.class_std} · {exam.paper.subject} · {exam.questionCount} questions</p><div className="exam-card-counts"><span><Users/> {exam.attemptCount} attempts</span><span><Radio/> {exam.liveCount} live</span><span><Clock3/> {exam.durationMinutes} min</span></div><footer><button type="button" className="exam-card-open" onClick={() => void open(exam)}><span>Open tracking & results</span><BarChart3 size={16}/></button></footer></article>)}</section>}</main>{deleteDialog}</>;
}
