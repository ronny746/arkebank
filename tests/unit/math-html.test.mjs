import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderContentToHtml } from '../../src/lib/math-html.ts';

test('stored HTML in prose is escaped, never executed', () => {
  const html = renderContentToHtml('Hi <img src=x onerror=alert(1)><script>alert(2)</script>');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('entity-encoded script stays text', () => {
  const html = renderContentToHtml('&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.ok(!html.includes('<script'));
});

test('attribute-carrying br/sub tags are not restored', () => {
  const html = renderContentToHtml('a<br onclick=alert(1)>b<sub onmouseover=x>2</sub>');
  assert.ok(!/<br[^ />]/.test(html) && !html.includes('<br onclick'));
  assert.ok(!html.includes('<sub onmouseover'));
});

test('plain br/sub/sup render as tags', () => {
  const html = renderContentToHtml('H<sub>2</sub>O<br>x<sup>2</sup>');
  assert.ok(html.includes('<sub>2</sub>'));
  assert.ok(html.includes('<sup>2</sup>'));
  assert.ok(html.includes('<br />'));
});

test('prose entities keep rendering as symbols (regression)', () => {
  const html = renderContentToHtml('Angle 30&deg; and 2&times;3 cost &#8377;5');
  assert.ok(html.includes('30&deg;'));
  assert.ok(html.includes('2&times;3'));
  assert.ok(html.includes('&#8377;5'));
  assert.ok(!html.includes('&amp;deg;'));
});

test('math with stored entities renders through KaTeX, not as an error', () => {
  const html = renderContentToHtml('Solve $x &le; 2$ now');
  assert.ok(html.includes('katex'));
  assert.ok(!html.includes('katex-error'));
  assert.ok(html.includes('≤'));
});

test('array rows split on <br> inside math (regression)', () => {
  const html = renderContentToHtml('$\\begin{array}{cc} a & b <br> c & d \\end{array}$');
  assert.ok(html.includes('katex'));
  assert.ok(!html.includes('katex-error'));
  assert.ok(!html.includes('&lt;br'));
});

test('empty input', () => {
  assert.equal(renderContentToHtml(''), '');
  assert.equal(renderContentToHtml(null), '');
});
