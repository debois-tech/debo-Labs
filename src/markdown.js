// A deliberately tiny markdown renderer for lab text. Everything is HTML-escaped
// FIRST, so community-contributed lab content can never inject markup or script.
// Supported: paragraphs, - bullet lists, 1. numbered lists, ``` fences,
// `inline code`, **bold**, [text](http(s)://link).
const { esc } = require('./ui');

function inline(src) {
  const codes = [];
  let t = esc(src).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0001' + (codes.length - 1) + '\u0001'; });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t.replace(/\u0001(\d+)\u0001/g, (_, i) => '<code>' + codes[i] + '</code>');
}

function renderMarkdown(text) {
  const lines = String(text || '').replace(/[\u0000\u0001]/g, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
    } else if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
      const tag = /^\s*\d+\. /.test(line) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) items.push(inline(lines[i++].replace(/^\s*([-*]|\d+\.) /, '')));
      out.push(`<${tag}>` + items.map((x) => `<li>${x}</li>`).join('') + `</${tag}>`);
    } else if (!line.trim()) {
      i++;
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^\s*([-*]|\d+\.) /.test(lines[i])) buf.push(lines[i++]);
      out.push('<p>' + inline(buf.join(' ')) + '</p>');
    }
  }
  return out.join('\n');
}

module.exports = { renderMarkdown, esc };
