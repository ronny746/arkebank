'use client';

import React from 'react';
import Image from 'next/image';
import { QuestionItem, PaperMetadata } from '@/types/paper';
import MathRenderer from '../MathRenderer';

interface PaperPrintableDocumentProps {
  metadata: PaperMetadata;
  questions: QuestionItem[];
  mode: 'paper' | 'solutions'; // 'paper' = student test, 'solutions' = teacher booklet
  onImageZoom?: (url: string, title?: string) => void;
  optionFormat?: 'abcd' | '1234';
  columnsMode?: '1-col' | '2-col';
  optionsLayout?: '2-col' | '4-col' | '1-col';
}

export default function PaperPrintableDocument({
  metadata,
  questions,
  mode,
  onImageZoom,
  optionFormat = 'abcd',
  columnsMode = '1-col',
  optionsLayout = '2-col',
}: PaperPrintableDocumentProps) {
  const isSolutions = mode === 'solutions';

  // Compute stats
  const totalQuestions = questions.length;
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 4), 0);

  // Helper for option key display: A/B/C/D or 1/2/3/4
  const formatOptionKey = (key: string): string => {
    const lower = (key || '').toLowerCase();
    if (optionFormat === '1234') {
      if (lower === 'a') return '1';
      if (lower === 'b') return '2';
      if (lower === 'c') return '3';
      if (lower === 'd') return '4';
      return key;
    }
    return key.toUpperCase();
  };

  return (
    <div className={`paper-printable-root ${isSolutions ? 'mode-solutions' : 'mode-paper'} layout-${columnsMode}`}>
      {/* Watermark (for authentic official exam look) */}
      {metadata.showWatermark !== false && (
        <div className="paper-watermark">
          {metadata.watermarkText || 'ARKE SCHOLARS'}
        </div>
      )}

      {/* Official Exam Paper Header */}
      <div className="paper-exam-header">
        <div className="header-top-row">
          <div className="exam-logo-box">
            <Image
              src="/logo.png"
              alt="Logo"
              width={56}
              height={44}
              className="paper-header-logo"
            />
          </div>
          <div className="exam-titles-box">
            <h1 className="exam-institute-name">{metadata.instituteName || 'ARKE SCHOLARS ACADEMY'}</h1>
            <h2 className="exam-paper-title">{metadata.title || 'Comprehensive Assessment Examination'}</h2>
            {isSolutions && (
              <span className="exam-solutions-tag">TEACHER EVALUATION & DETAILED SOLUTIONS BOOKLET</span>
            )}
          </div>
        </div>

        {/* Exam Meta Specs Grid */}
        <div className="exam-meta-grid">
          <div className="meta-col">
            <span className="meta-label">Class:</span>
            <span className="meta-val">{metadata.class_std || 'All Classes'}</span>
          </div>
          <div className="meta-col">
            <span className="meta-label">Subject:</span>
            <span className="meta-val">{metadata.subject || 'General'}</span>
          </div>
          <div className="meta-col">
            <span className="meta-label">Time Allowed:</span>
            <span className="meta-val">{metadata.timeAllowed || '60 Mins'}</span>
          </div>
          <div className="meta-col">
            <span className="meta-label">Maximum Marks:</span>
            <span className="meta-val">{totalMarks} Marks</span>
          </div>
          <div className="meta-col">
            <span className="meta-label">Total Questions:</span>
            <span className="meta-val">{totalQuestions} Qs</span>
          </div>
          <div className="meta-col">
            <span className="meta-label">Date:</span>
            <span className="meta-val">{metadata.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Candidate Details Box (Student Examination Paper) */}
        {!isSolutions && (
          <div className="candidate-details-box">
            <div className="candidate-field">
              <span className="candidate-label">Candidate Name:</span>
              <span className="candidate-line"></span>
            </div>
            <div className="candidate-field">
              <span className="candidate-label">Roll Number:</span>
              <span className="candidate-line"></span>
            </div>
            <div className="candidate-field">
              <span className="candidate-label">Invigilator Sign:</span>
              <span className="candidate-line"></span>
            </div>
          </div>
        )}

        {/* General Instructions Box */}
        {metadata.instructions && metadata.instructions.length > 0 && (
          <div className="exam-instructions-box">
            <div className="instructions-header">GENERAL INSTRUCTIONS:</div>
            <ol className="instructions-list">
              {metadata.instructions.map((ins, i) => (
                <li key={i}>{ins}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Quick Answer Key Matrix for Solutions View */}
      {isSolutions && (
        <div className="quick-answer-matrix">
          <div className="matrix-title">QUICK ANSWER KEY GRID</div>
          <div className="matrix-grid">
            {questions.map((q, idx) => {
              const rawOpt = q.correct_option || q.correct_answer || '-';
              const formattedOpt = formatOptionKey(rawOpt);
              return (
                <div key={q._id || idx} className="matrix-cell">
                  <span className="cell-num">Q{idx + 1}</span>
                  <span className="cell-opt">({formattedOpt})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Questions Flow (Single Column or Dual Column Layout) */}
      <div className={`paper-questions-flow cols-${columnsMode}`}>
        {questions.map((q, idx) => {
          const qNumber = idx + 1;
          const qMarks = Number(q.marks) || 4;
          const qNeg = Number(q.negative_marks) || 1;

          return (
            <div key={q._id || q.id || idx} className="paper-question-block">
              {/* Question Header Line */}
              <div className="paper-q-header">
                <div className="paper-q-num-box">
                  <span className="paper-q-num">Q{qNumber}.</span>
                  {q.topic && (
                    <span className="paper-q-topic">[{q.topic}]</span>
                  )}
                </div>
                <div className="paper-q-marks-box">
                  <span className="marks-badge">[{qMarks} M | -{qNeg}]</span>
                </div>
              </div>

              {/* Question Body */}
              <div className="paper-q-body">
                <MathRenderer content={q.question} />

                {/* Question Diagram / Image */}
                {q.question_image && (
                  <div className="paper-q-image-container">
                    <img
                      src={q.question_image}
                      alt={`Question ${qNumber} diagram`}
                      className="paper-diagram-img"
                      onClick={() => onImageZoom && onImageZoom(q.question_image || '', `Question ${qNumber} Diagram`)}
                    />
                  </div>
                )}
              </div>

              {/* Options Grid */}
              {Array.isArray(q.options) && q.options.length > 0 && (
                <div className={`paper-options-grid grid-${optionsLayout}`}>
                  {q.options.map((opt) => {
                    const displayKey = formatOptionKey(opt.key);
                    const isCorrect = isSolutions && (
                      (q.correct_option && q.correct_option.toLowerCase() === opt.key?.toLowerCase()) ||
                      (q.correct_answer && q.correct_answer.toLowerCase() === opt.key?.toLowerCase())
                    );

                    return (
                      <div
                        key={opt.key}
                        className={`paper-option-item ${isCorrect ? 'option-correct-highlight' : ''}`}
                      >
                        <span className={`option-letter-badge ${isCorrect ? 'badge-correct' : ''}`}>
                          ({displayKey})
                        </span>
                        <div className="option-content-text">
                          {opt.text && <MathRenderer content={opt.text} inline />}
                          {opt.image && (
                            <div className="option-img-wrap">
                              <img
                                src={opt.image}
                                alt={`Option ${displayKey}`}
                                className="paper-option-img"
                                onClick={() => onImageZoom && onImageZoom(opt.image || '', `Option (${displayKey}) Diagram`)}
                              />
                            </div>
                          )}
                        </div>
                        {isCorrect && (
                          <span className="correct-check-icon">✓ Correct</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step-by-Step Solution & Explanation (Only in Solutions Booklet Mode) */}
              {isSolutions && (
                <div className="paper-solution-box">
                  <div className="solution-box-header">
                    <span className="sol-badge">
                      Correct: Option ({formatOptionKey(q.correct_option || q.correct_answer || '')})
                    </span>
                    <span className="sol-heading">Step-by-Step Editorial Solution</span>
                  </div>
                  <div className="solution-box-body">
                    {q.solution ? (
                      <MathRenderer content={q.solution} />
                    ) : (
                      <p className="no-sol-text">
                        Correct answer confirmed as Option ({formatOptionKey(q.correct_option || q.correct_answer || '')}).
                      </p>
                    )}

                    {q.solution_image && (
                      <div className="paper-sol-image-container">
                        <img
                          src={q.solution_image}
                          alt={`Solution diagram for Q${qNumber}`}
                          className="paper-diagram-img"
                          onClick={() => onImageZoom && onImageZoom(q.solution_image || '', `Solution ${qNumber} Diagram`)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Official End of Paper Line */}
      <div className="paper-exam-footer">
        <div className="footer-line"></div>
        <div className="footer-text">
          <span>*** END OF EXAMINATION PAPER - ARKE SCHOLARS ASSESSMENT SYSTEM ***</span>
        </div>
      </div>
    </div>
  );
}
