'use client';

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ZoomIn, 
  Calendar, 
  Award, 
  Layers, 
  BookOpen, 
  Pencil,
  HelpCircle,
  Plus,
  Check
} from 'lucide-react';
import MathRenderer from './MathRenderer';

interface QuestionCardProps {
  question: any;
  index: number;
  onImageZoom: (url: string, title?: string) => void;
  onInspectTags?: (question: any) => void;
  onEditTags: (question: any) => void;
}

export default function QuestionCard({
  question,
  index,
  onImageZoom,
  onInspectTags,
  onEditTags,
}: QuestionCardProps) {
  const [q, setQuestion] = useState(question);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => setQuestion(question), [question]);

  const switchLanguage = async (targetLang: 'en' | 'hi') => {
    if (String(q.lang || 'en').toLowerCase() === targetLang || switchingLanguage) return;
    setSwitchingLanguage(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch('/api/questions/switch-lang', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ questionId: q.id, targetLang, subject: q.subject, topic: q.topic, difficulty: q.difficulty }),
      });
      const data = await response.json();
      if (!response.ok || !data.question) throw new Error(data.error || 'Translation is unavailable.');
      setQuestion({ ...data.question, available_languages: q.available_languages });
    } catch (error) {
      console.warn('Question language switch failed', error);
    } finally {
      setSwitchingLanguage(false);
    }
  };

  const getDifficultyBadge = (diff: any) => {
    const val = String(diff);
    if (val === '0') return <span className="badge badge-diff-basic">Easy (Tier 0)</span>;
    if (val === '1') return <span className="badge badge-diff-easy">Easy (Tier 1)</span>;
    if (val === '2') return <span className="badge badge-diff-med">Moderate (Tier 2)</span>;
    if (val === '3') return <span className="badge badge-diff-hard">Tough (Tier 3)</span>;
    if (val === '4') return <span className="badge badge-diff-expert">Expert (Tier 4)</span>;
    return <span className="badge badge-diff-med">Standard</span>;
  };

  const getExamBadgeText = (examItem: any): string => {
    if (!examItem) return '';
    if (typeof examItem === 'string') return examItem;
    if (typeof examItem === 'object') {
      if (examItem.que_year?.name && examItem.que_year?.year) {
        return `${examItem.que_year.name} ${examItem.que_year.year}`;
      }
      if (examItem.name) return String(examItem.name);
      if (examItem.que_year?.name) return String(examItem.que_year.name);
      return '';
    }
    return String(examItem);
  };

  const isOptionCorrect = (optKey: string) => {
    if (!q.correct_option) return false;
    const cleanCorrect = String(q.correct_option).toLowerCase().trim();
    return cleanCorrect.includes(optKey.toLowerCase());
  };

  const hasOptions = q.options && q.options.some((opt: any) => 
    (opt.text && String(opt.text).trim() !== '') || (opt.image && String(opt.image).trim() !== '')
  );

  const isNumericalQuestion = !hasOptions && q.correct_answer && String(q.correct_answer).trim() !== '';

  const firstExamBadge = Array.isArray(q.question_exams) && q.question_exams.length > 0 
    ? getExamBadgeText(q.question_exams[0]) 
    : '';

  return (
    <article className="question-card" id={`q-${q.id}`}>
      {/* Top Meta Bar */}
      <div className="card-top-bar">
        <div className="card-left-tags">
          <span className="q-index-pill">Q.{index}</span>
          <span className="badge badge-subject">{q.subject || 'General'}</span>
          <span className="badge badge-class">{q.class_std}</span>
          {getDifficultyBadge(q.difficulty)}
          {q.year && Number(q.year) > 0 ? (
            <span className="badge badge-pyq">
              <Calendar size={11} />
              <span>PYQ {q.year}</span>
            </span>
          ) : null}
          {firstExamBadge && (
            <span className="badge badge-exam">{firstExamBadge}</span>
          )}
          {Array.isArray(q.available_languages) && q.available_languages.length > 1 ? (
            <span className="question-language-switch" aria-label="Question language">
              {(['en', 'hi'] as const).filter((lang) => q.available_languages.includes(lang)).map((lang) => <button type="button" key={lang} className={String(q.lang || 'en').toLowerCase() === lang ? 'active' : ''} onClick={() => void switchLanguage(lang)} disabled={switchingLanguage}>{lang.toUpperCase()}</button>)}
            </span>
          ) : <span className="badge badge-lang">{q.lang ? String(q.lang).toUpperCase() : 'EN'}</span>}
        </div>

        <div className="card-right-actions">
          <span className="badge badge-id">#{q.id}</span>
          <button
            type="button"
            onClick={() => onEditTags(q)}
            className="btn-card-action btn-edit-tag"
            title="Edit question text, difficulty, subject, year, options & solution"
          >
            <Pencil size={12} />
            <span>Edit Question</span>
          </button>

        </div>
      </div>

      {/* Breadcrumb Hierarchy */}
      {(q.topic || q.sub_topic) && (
        <div className="taxonomy-breadcrumb">
          <BookOpen size={12} className="crumb-icon" />
          <span className="crumb-topic">{q.topic || 'General Topic'}</span>
          {q.sub_topic && (
            <>
              <span className="crumb-sep">›</span>
              <span className="crumb-subtopic">{q.sub_topic}</span>
            </>
          )}
          {q.paper && (
            <>
              <span className="crumb-sep">•</span>
              <span className="crumb-paper">{q.paper}</span>
            </>
          )}
        </div>
      )}

      {/* Question Statement */}
      <div className="question-body">
        <MathRenderer content={q.question} className="question-text-prose" />

        {/* Dedicated Diagram */}
        {q.question_image && String(q.question_image).trim() !== '' && (
          <div className="diagram-container">
            <div className="diagram-header">
              <span className="diagram-title">Reference Diagram</span>
              <button
                type="button"
                onClick={() => onImageZoom(q.question_image!, `Question #${q.id} Diagram`)}
                className="btn-zoom"
              >
                <ZoomIn size={12} />
                <span>Zoom Diagram</span>
              </button>
            </div>
            <div
              className="diagram-image-wrapper"
              onClick={() => onImageZoom(q.question_image!, `Question #${q.id} Diagram`)}
            >
              <img
                src={q.question_image}
                alt={`Question ${q.id} Diagram`}
                className="diagram-img"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      {/* MCQ Options Grid */}
      {hasOptions && (
        <div className="options-grid">
          {q.options.map((opt: any) => {
            const correct = isOptionCorrect(opt.key);
            return (
              <div
                key={opt.key}
                className={`option-item ${correct ? 'option-correct' : ''}`}
              >
                <div className="option-key-badge">
                  <span>{String(opt.key).toUpperCase()}</span>
                  {correct && <CheckCircle2 size={14} className="text-emerald check-icon" />}
                </div>
                <div className="option-content">
                  {opt.text && String(opt.text).trim() !== '' ? (
                    <MathRenderer content={opt.text} />
                  ) : (
                    <span className="text-muted">(Diagram only)</span>
                  )}
                  {opt.image && String(opt.image).trim() !== '' && (
                    <img
                      src={opt.image}
                      alt={`Option ${opt.key}`}
                      className="option-diagram-img"
                      onClick={() => onImageZoom(opt.image!, `Option ${opt.key} Image`)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Numerical Answer Banner */}
      {isNumericalQuestion && (
        <div className="numerical-answer-banner">
          <div className="numerical-banner-left">
            <Award size={16} className="text-emerald" />
            <span className="numerical-label">Numerical / Integer Answer:</span>
          </div>
          <div className="numerical-value-box">
            <MathRenderer content={q.correct_answer} inline />
          </div>
        </div>
      )}

      {/* Collapsible Solution Section */}
      <div className="solution-section">
        <button
          type="button"
          onClick={() => setShowSolution(!showSolution)}
          className={`solution-toggle-btn ${showSolution ? 'active' : ''}`}
        >
          <div className="solution-toggle-left">
            <Layers size={14} />
            <span>{showSolution ? 'Hide Solution' : 'View Verified Editorial Solution & Proof'}</span>
          </div>
          {showSolution ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSolution && (
          <div className="solution-drawer">
            <div className="solution-content">
              <div className="solution-badge-row">
                <span className="badge badge-solution-tag">Verified Editorial Solution</span>
                {q.correct_option && (
                  <span className="badge badge-correct-choice">
                    Correct Choice: <b>{String(q.correct_option).toUpperCase()}</b>
                  </span>
                )}
                {q.correct_answer && String(q.correct_answer).trim() !== '' && (
                  <span className="badge badge-correct-val">
                    Answer Value: <MathRenderer content={q.correct_answer} inline />
                  </span>
                )}
              </div>

              {q.solution && String(q.solution).trim() !== '' ? (
                <MathRenderer content={q.solution} className="solution-text-prose" />
              ) : (
                <div className="solution-empty-note">
                  <HelpCircle size={14} />
                  <span>Standard solution verification key recorded in official examination boards.</span>
                </div>
              )}

              {/* Solution Diagram */}
              {q.solution_image && String(q.solution_image).trim() !== '' && (
                <div className="diagram-container solution-diagram">
                  <div className="diagram-header">
                    <span className="diagram-title">Solution Step Derivation Diagram</span>
                    <button
                      type="button"
                      onClick={() => onImageZoom(q.solution_image!, `Solution #${q.id} Diagram`)}
                      className="btn-zoom"
                    >
                      <ZoomIn size={12} />
                      <span>Zoom Diagram</span>
                    </button>
                  </div>
                  <div
                    className="diagram-image-wrapper"
                    onClick={() => onImageZoom(q.solution_image!, `Solution #${q.id} Diagram`)}
                  >
                    <img
                      src={q.solution_image}
                      alt={`Solution ${q.id} Diagram`}
                      className="diagram-img"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
