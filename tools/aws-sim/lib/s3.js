// aws s3 ...  (the high-level commands: mb, rb, ls, cp, mv, rm, sync, presign)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./s3store');
const { iso } = require('./core');

const isS3 = (p) => typeof p === 'string' && p.startsWith('s3://');
function split(uri, c, prefix) {
  const m = String(uri).match(/^s3:\/\/([^/]+)(?:\/(.*))?$/);
  if (!m) c.fail('Error', `Invalid S3 URI: ${uri}`, { exit: 252 });
  return { bucket: m[1], key: m[2] || '' };
}
const shown = (p) => (isS3(p) || path.isAbsolute(p) || p.startsWith('.') ? p : './' + p);
const region = (c) => c.region || 'us-east-1';
const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
function filterKeys(c, keys) {
  const inc = c.list('include').map(globRe), exc = c.list('exclude').map(globRe);
  return keys.filter((k) => {
    let ok = true;
    for (const [kind, re] of [...exc.map((r) => ['x', r]), ...inc.map((r) => ['i', r])]) if (re.test(k)) ok = kind === 'i';
    return ok;
  });
}
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]));
const storageClass = (c) => (c.flag('storage-class') && c.flag('storage-class') !== true ? c.flag('storage-class') : 'STANDARD');
const pad = (n, w) => String(n).padStart(w);

function upload(c, localPath, bucketName, key, label) {
  const b = S.bucket(c, bucketName, { prefix: `upload failed: ${shown(localPath)} to s3://${bucketName}/${key}` });
  let buf;
  try { buf = fs.readFileSync(localPath); } catch { c.fail('Error', `The user-provided path ${localPath} does not exist.`, { exit: 255 }); }
  S.putObject(c, b, key, buf, storageClass(c));
  c.out(`${label || 'upload'}: ${shown(localPath)} to s3://${bucketName}/${key}`);
}
function download(c, bucketName, key, localPath, label) {
  const b = S.bucket(c, bucketName);
  const v = S.current(b, key);
  if (!v) c.fail('NoSuchKey', 'The specified key does not exist.', { exit: 1, prefix: `download failed: s3://${bucketName}/${key} to ${shown(localPath)}` });
  fs.mkdirSync(path.dirname(path.resolve(localPath)), { recursive: true });
  fs.writeFileSync(localPath, S.readBlob(v));
  c.out(`${label || 'download'}: s3://${bucketName}/${key} to ${shown(localPath)}`);
}

function copy(c, move) {
  const [src, dst] = c.pos;
  if (!src || !dst) c.fail('Error', `usage: aws s3 ${move ? 'mv' : 'cp'} <LocalPath> <S3Uri> or <S3Uri> <LocalPath> or <S3Uri> <S3Uri>`, { exit: 252 });
  const rec = c.bool('recursive');
  const label = move ? 'move' : null;
  if (!isS3(src) && isS3(dst)) {
    const d = split(dst, c);
    if (rec) {
      for (const rel of filterKeys(c, walk(src))) upload(c, path.join(src, rel), d.bucket, d.key + rel.split(path.sep).join('/'), label);
    } else {
      const key = !d.key || d.key.endsWith('/') ? d.key + path.basename(src) : d.key;
      upload(c, src, d.bucket, key, label);
    }
    if (move) fs.rmSync(src, { recursive: true, force: true });
  } else if (isS3(src) && !isS3(dst)) {
    const s = split(src, c);
    if (rec) {
      const b = S.bucket(c, s.bucket);
      for (const key of filterKeys(c, S.currentKeys(b, s.key))) download(c, s.bucket, key, path.join(dst, key.slice(s.key.length)), label);
    } else {
      const target = fs.existsSync(dst) && fs.statSync(dst).isDirectory() || dst.endsWith('/') ? path.join(dst, path.basename(s.key)) : dst;
      download(c, s.bucket, s.key, target, label);
    }
    if (move) rmKeys(c, s, rec, true);
  } else if (isS3(src) && isS3(dst)) {
    const s = split(src, c), d = split(dst, c);
    const sb = S.bucket(c, s.bucket), db = S.bucket(c, d.bucket);
    const keys = rec ? filterKeys(c, S.currentKeys(sb, s.key)) : [s.key];
    for (const key of keys) {
      const v = S.current(sb, key);
      if (!v) c.fail('NoSuchKey', 'The specified key does not exist.', { exit: 1, prefix: `copy failed: s3://${s.bucket}/${key} to s3://${d.bucket}/${d.key}` });
      const target = rec ? d.key + key.slice(s.key.length) : (!d.key || d.key.endsWith('/') ? d.key + path.basename(key) : d.key);
      S.putObject(c, db, target, S.readBlob(v), c.flag('storage-class') ? storageClass(c) : v.StorageClass);
      c.out(`${move ? 'move' : 'copy'}: s3://${s.bucket}/${key} to s3://${d.bucket}/${target}`);
    }
    if (move) rmKeys(c, s, rec, true);
  } else c.fail('Error', 'At least one of the paths must be an s3:// URI.', { exit: 252 });
}

function rmKeys(c, s, rec, quiet) {
  const b = S.bucket(c, s.bucket);
  const keys = rec ? filterKeys(c, S.currentKeys(b, s.key)) : [s.key];
  if (!rec && !S.current(b, s.key)) return;
  for (const key of keys) { S.deleteObject(b, key); if (!quiet) c.out(`delete: s3://${s.bucket}/${key}`); }
}

const ops = {
  mb: (c) => {
    const [uri] = c.pos;
    const { bucket } = split(uri, c);
    S.createBucket(c, bucket, region(c), { prefix: `make_bucket failed: s3://${bucket}` });
    c.out(`make_bucket: ${bucket}`);
  },
  rb: (c) => {
    const { bucket } = split(c.pos[0], c);
    const b = S.bucket(c, bucket, { prefix: `remove_bucket failed: s3://${bucket}` });
    if (!S.isEmpty(b)) {
      if (!c.bool('force')) c.fail('BucketNotEmpty', 'The bucket you tried to delete is not empty', { prefix: `remove_bucket failed: s3://${bucket}` });
      for (const key of S.currentKeys(b)) c.out(`delete: s3://${bucket}/${key}`);
      b.objects = {};
    }
    delete c.state.s3.buckets[bucket];
    c.out(`remove_bucket: ${bucket}`);
  },
  ls: (c) => {
    if (!c.pos[0]) {
      for (const b of Object.values(c.state.s3.buckets).sort((a, z) => a.created.localeCompare(z.created))) c.out(`${S.fmtDate(b.created)} ${b.name}`);
      return;
    }
    const { bucket, key } = split(c.pos[0], c);
    const b = S.bucket(c, bucket);
    const all = S.currentKeys(b, key);
    let total = 0, count = 0;
    const human = (n) => (n < 1024 ? `${n} Bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`);
    const line = (k, v) => {
      count++; total += v.Size;
      c.out(`${S.fmtDate(v.LastModified)} ${pad(c.bool('human-readable') ? human(v.Size) : v.Size, 10)} ${k}`);
    };
    if (c.bool('recursive')) all.forEach((k) => line(k, S.current(b, k)));
    else {
      const seen = new Set();
      for (const k of all) {
        const rest = k.slice(key.length), slash = rest.indexOf('/');
        if (slash >= 0) { const p = rest.slice(0, slash + 1); if (!seen.has(p)) { seen.add(p); c.out(`${' '.repeat(27)}PRE ${p}`); } }
        else line(rest, S.current(b, k));
      }
    }
    if (c.bool('summarize')) c.out(`\nTotal Objects: ${count}\n   Total Size: ${total}`);
  },
  cp: (c) => copy(c, false),
  mv: (c) => copy(c, true),
  rm: (c) => {
    const s = split(c.pos[0], c);
    S.bucket(c, s.bucket);
    rmKeys(c, s, c.bool('recursive'), false);
  },
  sync: (c) => {
    const [src, dst] = c.pos;
    if (!isS3(src) && isS3(dst)) {
      const d = split(dst, c), b = S.bucket(c, d.bucket);
      const prefix = d.key && !d.key.endsWith('/') ? d.key + '/' : d.key;
      const local = filterKeys(c, walk(src)).map((r) => r.split(path.sep).join('/'));
      for (const rel of local) {
        const cur = S.current(b, prefix + rel), size = fs.statSync(path.join(src, rel)).size;
        if (!cur || cur.Size !== size || crypto.createHash('md5').update(fs.readFileSync(path.join(src, rel))).digest('hex') !== cur.ETag.replace(/"/g, '')) upload(c, path.join(src, rel), d.bucket, prefix + rel);
      }
      if (c.bool('delete')) for (const k of S.currentKeys(b, prefix)) if (!local.includes(k.slice(prefix.length))) { S.deleteObject(b, k); c.out(`delete: s3://${d.bucket}/${k}`); }
    } else if (isS3(src) && !isS3(dst)) {
      const s = split(src, c), b = S.bucket(c, s.bucket);
      const prefix = s.key && !s.key.endsWith('/') ? s.key + '/' : s.key;
      for (const k of filterKeys(c, S.currentKeys(b, prefix))) {
        const target = path.join(dst, k.slice(prefix.length));
        const cur = S.current(b, k);
        if (!fs.existsSync(target) || fs.statSync(target).size !== cur.Size) download(c, s.bucket, k, target);
      }
    } else c.fail('Error', 'sync needs one local directory and one s3:// path in this practice simulator.', { exit: 252 });
  },
  presign: (c) => {
    const { bucket, key } = split(c.pos[0], c);
    S.bucket(c, bucket);
    const exp = parseInt(c.flag('expires-in') || '3600', 10);
    if (!(exp > 0 && exp <= 604800)) c.fail('Error', 'Presigned URLs can be valid for at most 7 days (604800 seconds).', { exit: 252 });
    const date = iso().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const sig = crypto.createHash('sha256').update(`${bucket}/${key}/${date}/${exp}`).digest('hex');
    c.out(`https://${bucket}.s3.amazonaws.com/${encodeURI(key)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F${date.slice(0, 8)}%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=${date}&X-Amz-Expires=${exp}&X-Amz-SignedHeaders=host&X-Amz-Signature=${sig}`);
  },
};

// the API operation each high-level command is built on (what the real CLI names in its error messages)
const opNames = { mb: 'CreateBucket', rb: 'DeleteBucket', ls: 'ListObjectsV2', cp: 'CopyObject', mv: 'CopyObject', rm: 'DeleteObject', sync: 'ListObjectsV2', presign: 'GetObject' };

module.exports = { ops, opNames };
