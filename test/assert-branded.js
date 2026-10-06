// assertBrandedPage(html): the one definition of "this page has the Debo Labs chrome".
// The integration tests call it on every page, so header drift fails CI.
const assert = require('node:assert/strict');

function assertBrandedPage(html, where = '') {
  assert.match(html, /<link rel="stylesheet" href="\/app.css" \/>/, `${where}: app.css not linked`);
  assert.match(html, /<img class="logo-mark" src="\/logo\/debo-labs-logo\.png"/, `${where}: logo missing`);
  assert.match(html, /<span class="logo-word">Debo <span class="accent">Labs<\/span><\/span>/, `${where}: name missing`);
  assert.ok(!/<nav class="tabs"/.test(html), `${where}: the header has no tabs`);
  assert.match(html, /class="btn-site" href="https:\/\/www\.deboistech\.in\/"[^>]*rel="noopener noreferrer"/, `${where}: link to the main site`);
}

module.exports = { assertBrandedPage };
