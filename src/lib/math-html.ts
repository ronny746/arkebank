import katex from 'katex';

// Pure HTML builder behind <MathRenderer>, kept framework-free so its XSS and
// entity behaviour can be unit-tested (tests/unit/math-html.test.mjs).

function cleanMath(str: string): string {
  if (!str) return '';
  let m = str.trim();

  // 1. Replace HTML non-breaking spaces and line breaks inside LaTeX
  m = m.replace(/<br\s*\/?>/gi, ' \\\\ ');
  m = m.replace(/&nbsp;/gi, ' ');

  // 2. Decode HTML entities that break KaTeX
  m = m.replace(/&gt;/gi, '>');
  m = m.replace(/&lt;/gi, '<');
  m = m.replace(/&quot;/gi, '"');
  m = m.replace(/&#39;/gi, "'");
  m = m.replace(/&plusmn;/gi, '\\pm ');
  m = m.replace(/&times;/gi, '\\times ');
  m = m.replace(/&divide;/gi, '\\div ');
  m = m.replace(/&le;/gi, '\\le ');
  m = m.replace(/&ge;/gi, '\\ge ');
  m = m.replace(/&ne;/gi, '\\ne ');
  m = m.replace(/&deg;/gi, '^\\circ ');
  m = m.replace(/&infin;/gi, '\\infty ');

  // 3. Handle & inside \text{...} so it doesn't cause alignment parse errors
  m = m.replace(/(\\text\s*\{[^}]*?)(&)([^}]*?\})/g, '$1\\\\&$3');
  m = m.replace(/&amp;/gi, '&');

  // A legacy import exported column definitions such as *{20}{c}. KaTeX does
  // not support that LaTeX shorthand, so derive the actual column count from
  // the first row (the source data contains the correct row separators).
  m = m.replace(
    /\\begin\{array\}\{\*\{\d+\}\{([clr])\}\}([\s\S]*?)\\end\{array\}/g,
    (_, alignment: string, body: string) => {
      const firstRow = body.split(/\\\\/)[0] ?? '';
      const columnCount = Math.max(1, (firstRow.match(/&/g) ?? []).length + 1);
      return `\\begin{array}{${alignment.repeat(columnCount)}}${body}\\end{array}`;
    },
  );

  return m;
}

function renderMath(math: string, displayMode: boolean, fallback: string): string {
  try {
    return katex.renderToString(cleanMath(math), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Like escapeHtml, but keeps well-formed entities (&deg;, &times;, &#8377;)
 * so stored prose still renders symbols. An entity is inert text in HTML, so
 * this cannot introduce markup; every raw < > " ' is still escaped.
 */
function escapeProse(value: string): string {
  return value
    .replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function containsMatrix(math: string): boolean {
  return /\\begin\{(?:array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases)\}/.test(math);
}

/**
 * Turns stored question text into HTML: KaTeX output for math, escaped prose
 * for everything else. The result is the only string MathRenderer injects.
 */
export function renderContentToHtml(content?: string | null): string {
  if (!content) return '';

  let text = String(content);

  // Normalize escaped backslashes and HTML entities commonly stored in scraped JSON
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    .replace(/\\\\;/g, '\\;')
    // Preserve `\\\\ `: it is an array/matrix row separator followed by a space.
    .replace(/(?<!\\)\\ /g, ' ');

  // Keep rendered fragments out of subsequent passes. Some legacy records contain
  // an array environment without $...$ delimiters, while newer records do use them.
  const fragments: string[] = [];
  const stash = (html: string) => {
    const token = `@@ARKE_MATH_${fragments.length}@@`;
    fragments.push(html);
    return token;
  };

  // 1. Process explicitly-delimited display math: $$...$$ or \[...\]
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) =>
    stash(renderMath(math, true, escapeHtml(`$$${math}$$`))),
  );

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) =>
    stash(renderMath(math, true, escapeHtml(`\\[${math}\\]`))),
  );

  // 2. Process explicitly-delimited inline math: $...$ or \(...\)
  text = text.replace(/\$([^\$\n\r]+?)\$/g, (_, math) =>
    stash(renderMath(math, containsMatrix(math), escapeHtml(`$${math}$`))),
  );

  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) =>
    stash(renderMath(math, containsMatrix(math), escapeHtml(`\\(${math}\\)`))),
  );

  // 3. Older imported records sometimes store a complete matrix/determinant
  // without math delimiters. Render just that environment as a display block,
  // rather than exposing raw LaTeX (for example \"\\begin{array}\") to teachers.
  const bareMatrix = new RegExp(
    String.raw`(?:\\left\s*(?:\\\[|\\\{|\\\(|\\vert|\\lvert|\|))?\s*\{?(?:\s|\\[,;!])*\\begin\{(array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases)\}[\s\S]*?\\end\{\1\}(?:\s|\\[,;!])*\}?(?:\s*\\right\s*(?:\\\]|\\\}|\\\)|\\vert|\\rvert|\|))?`,
    'g',
  );
  text = text.replace(bareMatrix, (math) => stash(renderMath(math, true, escapeHtml(math))));

  // Math is extracted from the *raw* text first so cleanMath still sees the
  // entities and <br> row breaks it converts for KaTeX. Only the remaining
  // prose is escaped, so imported question HTML can never execute. The
  // stash tokens contain no escapable characters and survive this intact.
  text = escapeProse(text)
    // Attribute-free line breaks and sub/superscripts are common in stored
    // prose and carry no script risk, so restore just those exact tags.
    .replace(/&lt;br\s*\/?&gt;/gi, '<br />')
    .replace(/&lt;(\/?)(sub|sup)&gt;/gi, '<$1$2>');

  for (let index = 0; index < fragments.length; index += 1) {
    // Function replacer: KaTeX output can contain `$` sequences that a string
    // replacement would treat as special patterns.
    text = text.replace(`@@ARKE_MATH_${index}@@`, () => fragments[index]);
  }

  return text;
}
