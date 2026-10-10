// The simulated S3: buckets, objects (with versions and storage classes) and their bookkeeping. Object bytes live in
// $HOME/.aws-sim/blobs; everything else is in the state file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { STATE_DIR, hex, iso } = require('./core');

const STORAGE_CLASSES = ['STANDARD', 'REDUCED_REDUNDANCY', 'STANDARD_IA', 'ONEZONE_IA', 'INTELLIGENT_TIERING', 'GLACIER', 'DEEP_ARCHIVE', 'GLACIER_IR'];
// names somebody else already owns: the bucket namespace is global and shared by every AWS customer
const TAKEN = new Set(['my-bucket', 'mybucket', 'test', 'data', 'logs', 'backup', 'backups', 'images', 'example', 'example-bucket', 'bucket', 'photos', 'website', 'demo', 'prod', 'dev']);
const BLOBS = path.join(STATE_DIR, 'blobs');
const MAX_BYTES = 5 * 1024 * 1024;

function validName(n) {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(n) && !/^\d+\.\d+\.\d+\.\d+$/.test(n) && !n.includes('..');
}
function createBucket(c, name, region, { prefix = '' } = {}) {
  const fail = (code, msg) => { c.fail(code, msg, { prefix }); };
  if (!validName(name)) fail('InvalidBucketName', 'The specified bucket is not valid.');
  if (c.state.s3.buckets[name]) fail('BucketAlreadyOwnedByYou', 'Your previous request to create the named bucket succeeded and you already own it.');
  if (TAKEN.has(name)) fail('BucketAlreadyExists', 'The requested bucket name is not available. The bucket namespace is shared by all users of the system. Please select a different name and try again.');
  c.state.s3.buckets[name] = {
    name, created: iso(), region, versioning: null, objects: {}, policy: null, lifecycle: null, tags: null,
    publicAccessBlock: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true },
    encryption: { SSEAlgorithm: 'AES256' },
  };
  return c.state.s3.buckets[name];
}
function bucket(c, name, opts = {}) {
  const b = c.state.s3.buckets[name];
  if (!b) c.fail('NoSuchBucket', 'The specified bucket does not exist', opts);
  return b;
}
function putObject(c, b, key, buf, storageClass = 'STANDARD') {
  if (!STORAGE_CLASSES.includes(storageClass)) c.fail('InvalidStorageClass', 'The storage class you specified is not valid');
  if (buf.length > MAX_BYTES) c.fail('EntityTooLarge', 'Your proposed upload exceeds the maximum allowed size (this practice simulator keeps objects under 5 MB).');
  fs.mkdirSync(BLOBS, { recursive: true });
  const blob = hex(`${b.name}/${key}/${Date.now()}/${Math.random()}`, 24);
  fs.writeFileSync(path.join(BLOBS, blob), buf);
  const versioned = b.versioning === 'Enabled';
  const v = {
    VersionId: versioned ? hex(blob + 'v', 32) : 'null', LastModified: iso(), Size: buf.length, StorageClass: storageClass,
    ETag: '"' + crypto.createHash('md5').update(buf).digest('hex') + '"', blob, deleteMarker: false,
  };
  const o = b.objects[key] = b.objects[key] || { versions: [] };
  if (!versioned) o.versions = o.versions.filter((x) => x.VersionId !== 'null');
  o.versions.unshift(v);
  return v;
}
const current = (b, key) => { const o = b.objects[key]; return o && o.versions[0] && !o.versions[0].deleteMarker ? o.versions[0] : null; };
const readBlob = (v) => fs.readFileSync(path.join(BLOBS, v.blob));
function deleteObject(b, key, versionId) {
  const o = b.objects[key];
  if (versionId) {
    if (!o) return { VersionId: versionId };
    const hit = o.versions.find((x) => x.VersionId === versionId);
    o.versions = o.versions.filter((x) => x.VersionId !== versionId);
    if (!o.versions.length) delete b.objects[key];
    return { VersionId: versionId, ...(hit && hit.deleteMarker ? { DeleteMarker: true } : {}) };
  }
  if (b.versioning === 'Enabled') {
    const o2 = b.objects[key] = o || { versions: [] };
    const dm = { VersionId: hex(key + Date.now() + Math.random(), 32), LastModified: iso(), Size: 0, StorageClass: 'STANDARD', ETag: '', blob: null, deleteMarker: true };
    o2.versions.unshift(dm);
    return { DeleteMarker: true, VersionId: dm.VersionId };
  }
  delete b.objects[key];
  return {};
}
const currentKeys = (b, prefix = '') => Object.keys(b.objects).filter((k) => k.startsWith(prefix) && current(b, k)).sort();
const isEmpty = (b) => Object.keys(b.objects).length === 0;
const fmtDate = (iso8601) => iso8601.replace('T', ' ').slice(0, 19);
const httpDate = (iso8601) => new Date(iso8601).toUTCString();

module.exports = { STORAGE_CLASSES, validName, createBucket, bucket, putObject, current, readBlob, deleteObject, currentKeys, isEmpty, fmtDate, httpDate };
