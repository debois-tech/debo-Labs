// Core of the offline AWS CLI practice simulator: argument parsing (the CLI's own conventions), the state file,
// errors that look like the real CLI's, and output formatting (json / text, --query via JMESPath).
// Nothing here talks to a network. State lives in $HOME/.aws-sim/state.json, so every learner session starts clean.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let jmespath;
try { jmespath = require('jmespath'); } catch { jmespath = require(path.join(process.env.AWS_SIM_MODULES || '/app/node_modules', 'jmespath')); }

const HOME = process.env.HOME || os.homedir();
const STATE_DIR = path.join(HOME, '.aws-sim');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const ACCOUNT = '123456789012';          // the documentation example account id
const BOOL_FLAGS = new Set(['recursive', 'dryrun', 'dry-run', 'no-dry-run', 'force', 'human-readable', 'summarize', 'no-paginate',
  'no-cli-pager', 'no-sign-request', 'only-attached', 'debug', 'follow-symlinks', 'delete', 'quiet', 'no-verify-ssl']);

class AwsError extends Error {
  constructor(code, message, { exit = 254, prefix = '' } = {}) { super(message); this.code = code; this.exit = exit; this.prefix = prefix; }
}

// "create-user" -> "CreateUser" (the operation name the real CLI quotes in its errors)
const camel = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

function parseArgv(argv) {
  const pos = [];
  const flags = new Map();
  let i = 0;
  while (i < argv.length) {
    const t = argv[i];
    if (t.startsWith('--') && t.length > 2) {
      let name = t.slice(2);
      let vals = [];
      const eq = name.indexOf('=');
      if (eq >= 0) { vals = [name.slice(eq + 1)]; name = name.slice(0, eq); i++; }
      else if (BOOL_FLAGS.has(name)) { vals = [true]; i++; }
      else {
        i++;
        // a flag takes every following token up to the next flag (--instance-ids i-1 i-2)
        while (i < argv.length && !(argv[i].startsWith('--') && argv[i].length > 2)) vals.push(argv[i++]);
        if (!vals.length) vals = [true];
      }
      flags.set(name, (flags.get(name) || []).concat(vals));
    } else { pos.push(t); i++; }
  }
  return { pos, flags };
}

// ---- state -------------------------------------------------------------------------------------------------------
function seed() {
  return {
    version: 1, counter: 0, createdAt: new Date().toISOString(),
    // the identity every command runs as: the account's administrator user "learner"
    iam: { users: { learner: { UserName: 'learner', UserId: 'AIDAEXAMPLELEARNER01', CreateDate: new Date().toISOString(), Tags: [] } }, groups: {}, roles: {}, policies: {},
      userPolicies: { learner: ['arn:aws:iam::aws:policy/AdministratorAccess'] }, groupPolicies: {}, rolePolicies: {}, memberships: {}, accessKeys: {}, passwordPolicy: null },
    s3: { buckets: {} }, ec2: { instances: {}, groups: {}, keyPairs: {} },
    cloudwatch: { alarms: {} }, sns: { topics: {}, subscriptions: [] }, budgets: {},
  };
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return seed(); }
}
function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

// ---- config files (~/.aws/config and ~/.aws/credentials), INI with a [default] profile ---------------------------
function readIni(file) {
  const out = {};
  let cur = null;
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    const sec = line.match(/^\s*\[(?:profile\s+)?([^\]]+)\]\s*$/);
    if (sec) { cur = sec[1].trim(); out[cur] = out[cur] || {}; continue; }
    const kv = line.match(/^\s*([^=#;\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (kv && cur) out[cur][kv[1]] = kv[2];
  }
  return out;
}
function writeIni(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = Object.entries(data).map(([sec, kv]) => `[${sec}]\n` + Object.entries(kv).map(([k, v]) => `${k} = ${v}`).join('\n')).join('\n\n');
  fs.writeFileSync(file, body + '\n', { mode: 0o600 });
}
const CONFIG_FILE = path.join(HOME, '.aws', 'config');
const CREDS_FILE = path.join(HOME, '.aws', 'credentials');

// ---- value helpers -----------------------------------------------------------------------------------------------
function readFileUrl(v) {
  const p = v.slice('file://'.length);
  try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch { throw new AwsError('Error', `Error parsing parameter: Unable to load paramfile ${v}: [Errno 2] No such file or directory: '${p}'`, { exit: 252 }); }
}

// Shorthand syntax: Key=Name,Value=web  |  Name=a,Values=x,y  |  ResourceType=instance,Tags=[{Key=Name,Value=web}]
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function parseShorthandValue(v) {
  v = v.trim();
  if ((v.startsWith('[') && v.endsWith(']'))) return splitTop(v.slice(1, -1), ',').filter((x) => x.trim()).map(parseShorthandValue);
  if (v.startsWith('{') && v.endsWith('}')) return parseShorthand(v.slice(1, -1));
  return v;
}
function parseShorthand(s) {
  const obj = {};
  let last = null;
  for (const part of splitTop(s, ',')) {
    const eq = part.indexOf('=');
    if (eq > 0 && /^[A-Za-z][A-Za-z0-9]*$/.test(part.slice(0, eq))) {
      last = part.slice(0, eq);
      obj[last] = parseShorthandValue(part.slice(eq + 1));
    } else if (last) {                                         // a continuation of a list: Values=a,b
      obj[last] = [].concat(obj[last], parseShorthandValue(part));
    } else throw new AwsError('Error', `Error parsing parameter: Expected: '=', received: '${part}' for input:\n${s}`, { exit: 252 });
  }
  return obj;
}
// A parameter value: file://..., JSON, or shorthand.
function parseParam(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith('file://')) v = readFileUrl(v);
  const t = v.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch (e) {
      if (t.startsWith('{') && !t.includes('"')) return parseShorthand(t.slice(1, -1));
      throw new AwsError('Error', `Error parsing parameter: Invalid JSON: ${e.message}\nJSON received: ${t}`, { exit: 252 });
    }
  }
  return parseShorthand(t);
}

const hex = (seed, n) => crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, n).padEnd(n, '0');
const upper = (s) => s.toUpperCase();
const iso = (d = new Date()) => d.toISOString();

// ---- output ------------------------------------------------------------------------------------------------------
function scalarText(v) { return v === null || v === undefined ? 'None' : v === true ? 'True' : v === false ? 'False' : String(v); }
function toText(v) {
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) return v.map(scalarText).join('\t');
    return v.map((x) => (Array.isArray(x) ? x.map(scalarText).join('\t') : (x && typeof x === 'object' ? Object.values(x).filter((y) => y === null || typeof y !== 'object').map(scalarText).join('\t') : scalarText(x)))).join('\n');
  }
  if (v && typeof v === 'object') {
    const vals = Object.values(v);
    const nested = vals.filter((y) => y && typeof y === 'object');
    const scal = vals.filter((y) => !(y && typeof y === 'object')).map(scalarText).join('\t');
    return [scal, ...nested.map(toText)].filter((x) => x !== '').join('\n');
  }
  return scalarText(v);
}
function format(result, query, output) {
  if (query) {
    try { result = jmespath.search(result, query); } catch (e) { throw new AwsError('Error', `\nBad value for --query ${query}: ${e.message}`, { exit: 252 }); }
  }
  if (output === 'text') return toText(result);
  if (output && output !== 'json') throw new AwsError('Error', `Output format "${output}" is not supported by this practice simulator (use json or text).`, { exit: 252 });
  return JSON.stringify(result === undefined ? null : result, null, 4);
}

module.exports = {
  AwsError, camel, parseArgv, parseParam, parseShorthand, loadState, saveState, readIni, writeIni, hex, upper, iso, format,
  ACCOUNT, HOME, STATE_DIR, CONFIG_FILE, CREDS_FILE,
};
