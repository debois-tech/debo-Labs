// aws configure / configure set / get / list
const readline = require('readline');
const { readIni, writeIni, CONFIG_FILE, CREDS_FILE } = require('./core');

const mask = (v) => (v ? '****************' + v.slice(-4) : '<not set>');

function setKey(key, value) {
  const credKeys = ['aws_access_key_id', 'aws_secret_access_key'];
  const file = credKeys.includes(key) ? CREDS_FILE : CONFIG_FILE;
  const data = readIni(file);
  data.default = data.default || {};
  data.default[key] = value;
  writeIni(file, data);
}
const getKey = (key) => {
  const cfg = readIni(CONFIG_FILE).default || {}, cr = readIni(CREDS_FILE).default || {};
  return key in cr ? cr[key] : cfg[key];
};

// Lines are pulled from one iterator, so piped input (printf ... | aws configure) is not lost between questions.
async function ask(it, label, current) {
  process.stdout.write(`${label} [${current}]: `);
  const { value } = await it.next();
  return (value || '').trim();
}

module.exports = {
  defaultOp: 'interactive',
  ops: {
    async interactive() {
      const rl = readline.createInterface({ input: process.stdin, terminal: false });
      const it = rl[Symbol.asyncIterator]();
      const cur = (k) => getKey(k);
      const id = await ask(it, 'AWS Access Key ID', cur('aws_access_key_id') ? mask(cur('aws_access_key_id')) : 'None');
      const secret = await ask(it, 'AWS Secret Access Key', cur('aws_secret_access_key') ? mask(cur('aws_secret_access_key')) : 'None');
      const region = await ask(it, 'Default region name', cur('region') || 'None');
      const out = await ask(it, 'Default output format', cur('output') || 'None');
      rl.close();
      process.stdout.write('\n');
      if (id) setKey('aws_access_key_id', id);
      if (secret) setKey('aws_secret_access_key', secret);
      if (region) setKey('region', region);
      if (out) setKey('output', out);
    },
    set(c) {
      const [k, v] = c.pos;
      if (!k || v === undefined) c.fail('Error', 'usage: aws configure set <varname> <value>', { exit: 252 });
      setKey(k, v);
    },
    get(c) {
      const v = getKey(c.pos[0]);
      if (v === undefined) process.exit(1);
      c.out(v);
    },
    list(c) {
      const id = getKey('aws_access_key_id'), sk = getKey('aws_secret_access_key');
      const row = (n, v, t, l) => c.out(`${n.padStart(10)} ${String(v).padStart(24)} ${t.padStart(16)} ${l.padStart(8)}`);
      c.out('      Name                    Value             Type    Location');
      c.out('      ----                    -----             ----    --------');
      row('profile', '<not set>', 'None', 'None');
      row('access_key', id ? mask(id) : '<not set>', id ? 'shared-credentials-file' : 'None', id ? '' : 'None');
      row('secret_key', sk ? mask(sk) : '<not set>', sk ? 'shared-credentials-file' : 'None', sk ? '' : 'None');
      const r = getKey('region');
      row('region', r || '<not set>', r ? 'config-file' : 'None', r ? '~/.aws/config' : 'None');
    },
  },
};
