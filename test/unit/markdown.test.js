const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown } = require('../../src/markdown');

test('raw HTML and script tags from lab content are escaped, never emitted', () => {
  const html = renderMarkdown('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
});

test('inline code, bold, links and lists render', () => {
  const html = renderMarkdown('Run `ls -l` and **read** [docs](https://example.com).\n\n- one\n- two');
  assert.match(html, /<code>ls -l<\/code>/);
  assert.match(html, /<strong>read<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">docs<\/a>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test('javascript: links are not turned into anchors', () => {
  assert.ok(!renderMarkdown('[x](javascript:alert(1))').includes('<a '));
});

test('code inside backticks is not re-interpreted as bold/links, and fences keep content literal', () => {
  assert.match(renderMarkdown('`**not bold**`'), /<code>\*\*not bold\*\*<\/code>/);
  assert.match(renderMarkdown('```\necho "<b>"\n```'), /<pre><code>echo &quot;&lt;b&gt;&quot;<\/code><\/pre>/);
});

test('a quote in a link cannot break out of the href attribute', () => {
  const html = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!/onmouseover="/.test(html));
});
