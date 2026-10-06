// Small helpers shared by the content loaders.
const fs = require('fs');
const yaml = require('js-yaml');

// External links in contributed content must be plain https:// URLs.
function httpsUrl(u) {
  try { return new URL(String(u)).protocol === 'https:' ? String(u) : null; } catch { return null; }
}

// Never throws: problems are collected so a typo in a contributed file shows up as a warning instead of taking the site down.
function readYaml(file, problems) {
  try { return yaml.load(fs.readFileSync(file, 'utf8')) || {}; } catch (e) {
    problems.push(`${file}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

module.exports = { httpsUrl, readYaml, yaml };
