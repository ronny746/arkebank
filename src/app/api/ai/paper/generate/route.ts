import { NextResponse } from 'next/server';
import { extractAndVerifyToken } from '@/lib/auth-token';

type AiQuestion = {
  subject?: unknown;
  topic?: unknown;
  sub_topic?: unknown;
  difficulty?: unknown;
  question?: unknown;
  options?: unknown;
  correct_option?: unknown;
  solution?: unknown;
  diagram_svg?: unknown;
};

const MAX_QUESTIONS_PER_REQUEST = 25;
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const allowedTypes = new Set(['mcq', 'subjective', 'numerical', 'true_false']);

function cleanText(value: unknown, limit = 1200) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Claude did not return a valid question payload.');
  return JSON.parse(candidate.slice(start, end + 1));
}

function toSafeSvgDataUri(value: unknown) {
  const svg = cleanText(value, 60000);
  if (!svg || !/^<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return '';

  // The model output is treated as untrusted. Keep a compact, self-contained
  // SVG subset and reject executable, embedded, or externally-loaded content.
  if (/<\/?(?:script|foreignObject|iframe|object|embed|image|audio|video)\b|\bon\w+\s*=|(?:javascript|data):|\b(?:href|xlink:href)\s*=/i.test(svg)) return '';
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[character] || character));
}

/**
 * Claude sometimes returns prose, markdown, or an SVG that fails the strict
 * safety gate. A diagram request should never discard an otherwise valid
 * assessment batch, so retain a small, deterministic educational fallback.
 * It is intentionally self-contained and goes through the same sanitizer as
 * provider output.
 */
function createFallbackDiagram(subject: string, topic: string) {
  const label = escapeSvgText(`${subject} · ${topic}`.slice(0, 86));
  const normalized = `${subject} ${topic}`.toLowerCase();
  const base = (content: string) => toSafeSvgDataUri([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" role="img" aria-label="Educational diagram">',
    '<rect width="720" height="360" fill="#ffffff"/>',
    '<rect x="20" y="18" width="680" height="324" rx="18" fill="#f8fbff" stroke="#bfd1e8" stroke-width="2"/>',
    `<text x="48" y="58" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#173b6c">${label}</text>`,
    content,
    '<text x="48" y="318" font-family="Arial, sans-serif" font-size="14" fill="#5b6f8d">Schematic teaching diagram — verify labels before use</text>',
    '</svg>',
  ].join(''));

  if (/geometry|triangle|circle|angle|parallelogram|heron|area|coordinate/.test(normalized)) {
    return base([
      '<line x1="150" y1="260" x2="570" y2="260" stroke="#183b6a" stroke-width="4"/>',
      '<path d="M220 260 L360 105 L520 260 Z" fill="#dff4e9" stroke="#12945b" stroke-width="4"/>',
      '<line x1="360" y1="105" x2="360" y2="260" stroke="#f09a18" stroke-width="3" stroke-dasharray="8 7"/>',
      '<text x="205" y="282" font-family="Arial, sans-serif" font-size="20" fill="#173b6c">A</text>',
      '<text x="350" y="93" font-family="Arial, sans-serif" font-size="20" fill="#173b6c">B</text>',
      '<text x="524" y="282" font-family="Arial, sans-serif" font-size="20" fill="#173b6c">C</text>',
      '<text x="375" y="196" font-family="Arial, sans-serif" font-size="17" fill="#b76700">h</text>',
      '<text x="358" y="290" font-family="Arial, sans-serif" font-size="17" fill="#173b6c">base</text>',
    ].join(''));
  }

  if (/physics|current|electric|circuit|voltage|resistance|induct|capacitor|magnet/.test(normalized)) {
    return base([
      '<path d="M145 160 H245 M315 160 H465 M535 160 H575 V255 H145 V160" fill="none" stroke="#183b6a" stroke-width="4"/>',
      '<line x1="245" y1="120" x2="245" y2="200" stroke="#183b6a" stroke-width="5"/>',
      '<line x1="275" y1="135" x2="275" y2="185" stroke="#183b6a" stroke-width="3"/>',
      '<rect x="465" y="138" width="70" height="44" rx="5" fill="#fff4dc" stroke="#e48b14" stroke-width="3"/>',
      '<circle cx="355" cy="160" r="42" fill="#e8f2ff" stroke="#2d69a9" stroke-width="3"/>',
      '<text x="341" y="168" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#173b6c">A</text>',
      '<text x="220" y="112" font-family="Arial, sans-serif" font-size="17" fill="#173b6c">cell</text>',
      '<text x="476" y="168" font-family="Arial, sans-serif" font-size="17" fill="#173b6c">R</text>',
      '<text x="293" y="235" font-family="Arial, sans-serif" font-size="17" fill="#2d69a9">current I</text>',
    ].join(''));
  }

  if (/biology|cell|plant|animal|human|respiration|photosynthesis|organism/.test(normalized)) {
    return base([
      '<ellipse cx="360" cy="185" rx="180" ry="92" fill="#e4f7eb" stroke="#12945b" stroke-width="4"/>',
      '<circle cx="360" cy="185" r="48" fill="#d9eaff" stroke="#2d69a9" stroke-width="4"/>',
      '<circle cx="360" cy="185" r="17" fill="#6b8ed0"/>',
      '<ellipse cx="255" cy="150" rx="26" ry="14" fill="#f9d991" stroke="#c78518" stroke-width="3"/>',
      '<ellipse cx="470" cy="218" rx="26" ry="14" fill="#f9d991" stroke="#c78518" stroke-width="3"/>',
      '<text x="326" y="116" font-family="Arial, sans-serif" font-size="16" fill="#173b6c">nucleus</text>',
      '<text x="197" y="142" font-family="Arial, sans-serif" font-size="16" fill="#173b6c">organelle</text>',
      '<text x="473" y="246" font-family="Arial, sans-serif" font-size="16" fill="#173b6c">organelle</text>',
    ].join(''));
  }

  return base([
    '<line x1="150" y1="255" x2="570" y2="255" stroke="#183b6a" stroke-width="4"/>',
    '<line x1="220" y1="285" x2="220" y2="95" stroke="#183b6a" stroke-width="4"/>',
    '<polyline points="225,235 300,190 385,215 475,125 550,155" fill="none" stroke="#12945b" stroke-width="5"/>',
    '<circle cx="300" cy="190" r="7" fill="#12945b"/><circle cx="385" cy="215" r="7" fill="#12945b"/><circle cx="475" cy="125" r="7" fill="#12945b"/>',
    '<text x="180" y="95" font-family="Arial, sans-serif" font-size="16" fill="#173b6c">value</text>',
    '<text x="535" y="282" font-family="Arial, sans-serif" font-size="16" fill="#173b6c">step</text>',
  ].join(''));
}

async function generateDiagram({ apiKey, model, question, topic, subject }: { apiKey: string; model: string; question: string; topic: string; subject: string }) {
  const fallback = createFallbackDiagram(subject, topic);
  try {
    const diagramPrompt = [
      'Create one clean, minimal educational diagram for this Indian assessment question.',
      `Subject: ${subject}. Topic: ${topic}. Question: ${question}`,
      'Return ONLY a self-contained raw SVG beginning with <svg and ending with </svg>. Use viewBox="0 0 720 360".',
      'Use only svg, g, path, line, polyline, polygon, rect, circle, ellipse, text and title. No markdown, scripts, images, hrefs, external assets, CSS imports, or explanatory text.',
    ].join('\n');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1100, messages: [{ role: 'user', content: diagramPrompt }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const output = (payload?.content || []).filter((item: { type?: string }) => item.type === 'text').map((item: { text?: string }) => item.text || '').join('\n');
    const svg = output.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0] || '';
    return toSafeSvgDataUri(svg) || fallback;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const authUser = extractAndVerifyToken(request);
  if (!authUser) {
    return NextResponse.json({ success: false, error: 'Administrator authentication is required.' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      error: 'AI Paper Studio is not configured. Add ANTHROPIC_API_KEY on the server and restart the app.',
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const model = cleanText(process.env.ANTHROPIC_MODEL, 100) || DEFAULT_MODEL;
    const classStd = cleanText(body.classStd, 80);
    const targetExam = cleanText(body.targetExam, 80);
    const language = body.language === 'hi' ? 'Hindi' : 'English';
    const questionType = cleanText(body.questionType, 40);
    const subjects = Array.isArray(body.subjects)
      ? body.subjects.map((item: unknown) => cleanText(item, 80)).filter(Boolean).slice(0, 5)
      : [];
    const topics = Array.isArray(body.topics)
      ? body.topics.map((item: unknown) => cleanText(item, 120)).filter(Boolean).slice(0, 12)
      : [];
    const subTopics = Array.isArray(body.subTopics)
      ? body.subTopics.map((item: unknown) => cleanText(item, 120)).filter(Boolean).slice(0, 18)
      : [];
    const includeDiagrams = body.includeDiagrams === true;
    const requestedCount = Math.max(1, Math.min(includeDiagrams ? 5 : MAX_QUESTIONS_PER_REQUEST, Number(body.count) || 10));
    const marks = Math.max(1, Math.min(20, Number(body.marks) || 4));
    const negativeMarks = Math.max(0, Math.min(10, Number(body.negativeMarks) || 0));
    const difficulty = ['easy', 'medium', 'hard', 'mixed'].includes(body.difficulty) ? body.difficulty : 'mixed';

    if (!classStd || !subjects.length || !questionType || !allowedTypes.has(questionType)) {
      return NextResponse.json({ success: false, error: 'Choose class, at least one subject, and a valid question format.' }, { status: 400 });
    }

    // Constrained decoding prevents a malformed model response from breaking
    // the paper workflow halfway through a generation batch.
    const questionProperties: Record<string, unknown> = {
      subject: { type: 'string' },
      topic: { type: 'string' },
      sub_topic: { type: 'string' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      question: { type: 'string' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: { key: { type: 'string' }, text: { type: 'string' } },
          required: ['key', 'text'],
          additionalProperties: false,
        },
      },
      correct_option: { type: 'string' },
      solution: { type: 'string' },
    };
    const requiredQuestionFields = ['subject', 'topic', 'sub_topic', 'difficulty', 'question', 'options', 'correct_option', 'solution'];
    const outputSchema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: { type: 'object', properties: questionProperties, required: requiredQuestionFields, additionalProperties: false },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    };

    const prompt = [
      `You are an expert Indian assessment author. Create exactly ${requestedCount} original, curriculum-appropriate ${language} questions.`,
      '',
      'Assessment context:',
      `- Target exam or board: ${targetExam || 'School assessment'}`,
      `- Class / level: ${classStd}`,
      `- Subjects: ${subjects.join(', ')}`,
      `- Topics: ${topics.length ? topics.join(', ') : 'Choose balanced core concepts for the selected subjects'}`,
      `- Sub-topics: ${subTopics.length ? subTopics.join(', ') : 'Use useful syllabus-aligned sub-topics'}`,
      `- Format: ${questionType}`,
      `- Difficulty: ${difficulty}`,
      `- Marks per question: +${marks}, negative marks: -${negativeMarks}`,
      '',
      'Rules:',
      '1. Generate original questions only; never claim they are previous-year questions.',
      `2. Keep every question self-contained and factually sound.${includeDiagrams ? ' A separate diagram will be created after this step, so do not include SVG, image data, HTML, or a diagram field in this JSON.' : ' Do not require images, external references, or unsupported notation.'}`,
      '3. For mcq and true_false, include exactly four plausible options with keys a, b, c, d and give the correct_option key.',
      '4. For subjective and numerical, options must be an empty array and correct_option must be an empty string; provide a concise model answer in solution.',
      '5. Distribute questions sensibly across the selected subjects and requested topics.',
      '6. Do not include SVG, diagrams, image references, HTML, or any field outside the stated JSON shape.',
      '7. Return JSON only, matching this exact shape:',
      '{"questions":[{"subject":"...","topic":"...","sub_topic":"...","difficulty":"easy|medium|hard","question":"...","options":[{"key":"a","text":"..."},{"key":"b","text":"..."},{"key":"c","text":"..."},{"key":"d","text":"..."}],"correct_option":"a","solution":"..."}]}',
    ].join('\n');

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(12000, (includeDiagrams ? 1000 : 700) * requestedCount),
        output_config: {
          // Diagram batches are deliberately bounded and use medium effort so
          // faculty does not wait for a long-running reasoning request.
          effort: 'medium',
          format: { type: 'json_schema', schema: outputSchema },
        },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const claudeResponseText = await claudeResponse.text();
    let claudePayload: { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
    try {
      claudePayload = JSON.parse(claudeResponseText);
    } catch {
      throw new Error(`Claude returned an unreadable response (HTTP ${claudeResponse.status}). Try a smaller batch.`);
    }
    if (!claudeResponse.ok) {
      const message = cleanText(claudePayload?.error?.message, 300) || 'Claude could not generate questions right now.';
      // The faculty form was valid: this is an upstream model/account/request
      // rejection, not a bad UI submission. Keep the useful reason visible
      // without leaking credentials or the full prompt.
      console.error(`Anthropic generation rejected (HTTP ${claudeResponse.status}, model ${model}): ${message}`);
      return NextResponse.json({
        success: false,
        code: 'AI_PROVIDER_REJECTED',
        error: `Claude rejected the request for model “${model}”: ${message}`,
      }, { status: 502 });
    }

    const responseText = (claudePayload?.content || [])
      .filter((item: { type?: string }) => item.type === 'text')
      .map((item: { text?: string }) => item.text || '')
      .join('\n');
    const generated = extractJson(responseText);
    const now = Date.now();
    let questions = (Array.isArray(generated?.questions) ? generated.questions : [])
      .slice(0, requestedCount)
      .map((item: AiQuestion, index: number) => {
        const isObjective = questionType === 'mcq' || questionType === 'true_false';
        const options = Array.isArray(item.options)
          ? item.options.slice(0, 4).map((option: unknown, optionIndex: number) => {
              const record = option as { key?: unknown; text?: unknown };
              return { key: cleanText(record.key, 2).toLowerCase() || String.fromCharCode(97 + optionIndex), text: cleanText(record.text, 500) };
            }).filter((option: { text: string }) => Boolean(option.text))
          : [];
        return {
          _id: `ai_${crypto.randomUUID()}`,
          id: now + index,
          source: 'ai',
          ai_provider: 'anthropic',
          ai_model: model,
          class_std: classStd,
          subject: cleanText(item.subject, 80) || subjects[index % subjects.length],
          topic: cleanText(item.topic, 120) || topics[index % Math.max(1, topics.length)] || 'AI generated',
          sub_topic: cleanText(item.sub_topic, 120),
          difficulty: ['easy', 'medium', 'hard'].includes(cleanText(item.difficulty, 20).toLowerCase()) ? cleanText(item.difficulty, 20).toLowerCase() : difficulty === 'mixed' ? 'medium' : difficulty,
          lang: language === 'Hindi' ? 'hi' : 'en',
          question: cleanText(item.question, 4000),
          question_image: '',
          options: isObjective ? options : [],
          correct_option: isObjective ? cleanText(item.correct_option, 2).toLowerCase() : '',
          solution: cleanText(item.solution, 3000),
          marks,
          negative_marks: negativeMarks,
        };
      })
      .filter((question: { question: string; options: Array<{ text: string }>; question_image?: string }) => question.question
        && (questionType === 'mcq' || questionType === 'true_false' ? question.options.length === 4 : true));

    if (includeDiagrams && questions.length) {
      const diagrammedQuestions = await Promise.all(questions.map(async (question: { question: string; topic?: string; subject: string; question_image?: string; [key: string]: unknown }) => ({
        ...question,
        question_image: await generateDiagram({
          apiKey,
          model,
          question: question.question,
          topic: question.topic || 'General',
          subject: question.subject || subjects[0],
        }),
      })));
      questions = diagrammedQuestions.filter((question) => Boolean(question.question_image));
    }

    if (!questions.length) {
      return NextResponse.json({ success: false, error: includeDiagrams ? 'Claude did not return safe diagrams for this brief. Try a smaller batch or a more specific topic.' : 'Claude returned incomplete questions. Try generating again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, questions, generatedCount: questions.length, provider: 'anthropic' });
  } catch (error) {
    console.error('AI paper generation failed:', error instanceof Error ? error.message : error);
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Claude took too long to respond. Try a smaller batch.'
      : error instanceof Error ? error.message : 'AI question generation failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
