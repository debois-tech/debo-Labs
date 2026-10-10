// aws s3api ...  (the low-level S3 operations: JSON in, JSON out)
const fs = require('fs');
const crypto = require('crypto');
const S = require('./s3store');
const { hex, parseParam } = require('./core');

const bkt = (c) => S.bucket(c, c.req('bucket'));
const CLASSES = S.STORAGE_CLASSES;
const isPublic = (doc) => [].concat(doc.Statement || []).some((s) => s.Effect === 'Allow' && (s.Principal === '*' || (s.Principal && (s.Principal.AWS === '*' || [].concat(s.Principal.AWS || []).includes('*')))));
const lastMod = (v) => v.LastModified;

function lifecycleCheck(c, cfg) {
  if (!cfg || !Array.isArray(cfg.Rules) || !cfg.Rules.length) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
  for (const r of cfg.Rules) {
    if (!['Enabled', 'Disabled'].includes(r.Status)) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
    if (!r.Filter && r.Prefix === undefined) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
    let last = 0;
    for (const t of r.Transitions || []) {
      if (!CLASSES.includes(t.StorageClass) || t.StorageClass === 'STANDARD') c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
      if (['STANDARD_IA', 'ONEZONE_IA'].includes(t.StorageClass) && !(Number(t.Days) >= 30)) c.fail('InvalidArgument', `'Days' in the Transition action for StorageClass '${t.StorageClass}' for filter must be 30 days or more`);
      if (Number(t.Days) <= last && last) c.fail('InvalidArgument', "'Days' in the Transition action must be greater than the previous transition");
      last = Number(t.Days) || last;
    }
    if (r.Expiration && r.Expiration.Days !== undefined && last && Number(r.Expiration.Days) <= last) c.fail('InvalidArgument', "'Days' in the Expiration action for filter must be greater than 'Days' in the Transition action");
  }
}

const ops = {
  'create-bucket': (c) => {
    const name = c.req('bucket');
    const r = c.region || 'us-east-1';
    const conf = c.param('create-bucket-configuration');
    if (r !== 'us-east-1' && !(conf && conf.LocationConstraint)) c.fail('IllegalLocationConstraintException', 'The unspecified location constraint is incompatible for the region specific endpoint this request was sent to.');
    if (conf && conf.LocationConstraint && conf.LocationConstraint !== r) c.fail('IllegalLocationConstraintException', `The ${conf.LocationConstraint} location constraint is incompatible for the region specific endpoint this request was sent to.`);
    S.createBucket(c, name, r);
    return { Location: `/${name}` };
  },
  'delete-bucket': (c) => {
    const b = bkt(c);
    if (!S.isEmpty(b)) c.fail('BucketNotEmpty', 'The bucket you tried to delete is not empty');
    delete c.state.s3.buckets[b.name];
  },
  'list-buckets': (c) => ({ Buckets: Object.values(c.state.s3.buckets).map((b) => ({ Name: b.name, CreationDate: b.created })), Owner: { DisplayName: 'learner', ID: hex(c.account, 64) } }),
  'head-bucket': (c) => { if (!c.state.s3.buckets[c.req('bucket')]) c.fail('404', 'Not Found'); },
  'get-bucket-location': (c) => ({ LocationConstraint: bkt(c).region === 'us-east-1' ? null : bkt(c).region }),
  'put-object': (c) => {
    const b = bkt(c), key = c.req('key');
    let buf = Buffer.alloc(0);
    if (c.has('body')) { try { buf = fs.readFileSync(c.flag('body')); } catch { c.fail('Error', `Could not open file ${c.flag('body')}`, { exit: 255 }); } }
    const v = S.putObject(c, b, key, buf, c.flag('storage-class') || 'STANDARD');
    return { ETag: v.ETag, ServerSideEncryption: 'AES256', ...(b.versioning === 'Enabled' ? { VersionId: v.VersionId } : {}) };
  },
  'get-object': (c) => {
    const b = bkt(c), key = c.req('key');
    let v = S.current(b, key);
    if (c.flag('version-id')) v = ((b.objects[key] || { versions: [] }).versions.find((x) => x.VersionId === c.flag('version-id')));
    if (!v || v.deleteMarker) c.fail('NoSuchKey', 'The specified key does not exist.');
    const out = c.pos[0];
    if (!out) c.req('outfile');
    fs.writeFileSync(out, S.readBlob(v));
    return { AcceptRanges: 'bytes', LastModified: S.httpDate(v.LastModified), ContentLength: v.Size, ETag: v.ETag, ...(v.VersionId !== 'null' ? { VersionId: v.VersionId } : {}), ContentType: 'binary/octet-stream', ServerSideEncryption: 'AES256', Metadata: {}, ...(v.StorageClass !== 'STANDARD' ? { StorageClass: v.StorageClass } : {}) };
  },
  'head-object': (c) => {
    const b = bkt(c), key = c.req('key');
    const v = S.current(b, key);
    if (!v) c.fail('404', 'Not Found');
    return { AcceptRanges: 'bytes', LastModified: S.httpDate(v.LastModified), ContentLength: v.Size, ETag: v.ETag, ...(v.VersionId !== 'null' ? { VersionId: v.VersionId } : {}), ContentType: 'binary/octet-stream', ServerSideEncryption: 'AES256', Metadata: {}, ...(v.StorageClass !== 'STANDARD' ? { StorageClass: v.StorageClass } : {}) };
  },
  'delete-object': (c) => S.deleteObject(bkt(c), c.req('key'), c.flag('version-id')),
  'list-objects-v2': (c) => {
    const b = bkt(c), prefix = c.flag('prefix') && c.flag('prefix') !== true ? c.flag('prefix') : '';
    const keys = S.currentKeys(b, prefix);
    if (!keys.length) return { RequestCharged: null, Prefix: prefix };
    return { Contents: keys.map((k) => { const v = S.current(b, k); return { Key: k, LastModified: lastMod(v), ETag: v.ETag, Size: v.Size, StorageClass: v.StorageClass }; }), RequestCharged: null, Prefix: prefix };
  },
  'list-object-versions': (c) => {
    const b = bkt(c), prefix = c.flag('prefix') && c.flag('prefix') !== true ? c.flag('prefix') : '';
    const Versions = [], DeleteMarkers = [];
    for (const key of Object.keys(b.objects).filter((k) => k.startsWith(prefix)).sort()) {
      b.objects[key].versions.forEach((v, i) => {
        const base = { Key: key, VersionId: v.VersionId, IsLatest: i === 0, LastModified: v.LastModified, Owner: { ID: hex(c.account, 64) } };
        if (v.deleteMarker) DeleteMarkers.push(base); else Versions.push({ ETag: v.ETag, Size: v.Size, StorageClass: v.StorageClass, ...base });
      });
    }
    return { ...(Versions.length ? { Versions } : {}), ...(DeleteMarkers.length ? { DeleteMarkers } : {}), RequestCharged: null, Prefix: prefix };
  },
  'put-bucket-versioning': (c) => {
    const b = bkt(c), cfg = c.reqParam('versioning-configuration');
    if (!cfg || !['Enabled', 'Suspended'].includes(cfg.Status)) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
    b.versioning = cfg.Status;
  },
  'get-bucket-versioning': (c) => (bkt(c).versioning ? { Status: bkt(c).versioning } : {}),
  'put-public-access-block': (c) => {
    const b = bkt(c), cfg = c.reqParam('public-access-block-configuration') || {};
    const bool = (v) => v === true || v === 'true';
    b.publicAccessBlock = { BlockPublicAcls: bool(cfg.BlockPublicAcls), IgnorePublicAcls: bool(cfg.IgnorePublicAcls), BlockPublicPolicy: bool(cfg.BlockPublicPolicy), RestrictPublicBuckets: bool(cfg.RestrictPublicBuckets) };
  },
  'get-public-access-block': (c) => ({ PublicAccessBlockConfiguration: bkt(c).publicAccessBlock }),
  'delete-public-access-block': (c) => { bkt(c).publicAccessBlock = { BlockPublicAcls: false, IgnorePublicAcls: false, BlockPublicPolicy: false, RestrictPublicBuckets: false }; },
  'put-bucket-policy': (c) => {
    const b = bkt(c);
    c.req('policy');
    const raw = c.flag('policy').startsWith('file://') ? fs.readFileSync(c.flag('policy').slice(7), 'utf8') : c.flag('policy');
    let doc;
    try { doc = JSON.parse(raw); } catch { c.fail('MalformedPolicy', 'Policy has invalid resource'); }
    if (!doc.Statement) c.fail('MalformedPolicy', 'Missing required field Statement');
    if (isPublic(doc) && b.publicAccessBlock.BlockPublicPolicy) c.fail('AccessDenied', `User: arn:aws:iam::${c.account}:user/learner is not authorized to perform: s3:PutBucketPolicy on resource: "arn:aws:s3:::${b.name}" because public policies are blocked by the BlockPublicPolicy block public access setting.`);
    b.policy = raw;
  },
  'get-bucket-policy': (c) => { const b = bkt(c); if (!b.policy) c.fail('NoSuchBucketPolicy', 'The bucket policy does not exist'); return { Policy: JSON.stringify(JSON.parse(b.policy)) }; },
  'delete-bucket-policy': (c) => { bkt(c).policy = null; },
  'put-bucket-lifecycle-configuration': (c) => {
    const b = bkt(c), cfg = c.reqParam('lifecycle-configuration');
    lifecycleCheck(c, cfg);
    b.lifecycle = cfg;
  },
  'get-bucket-lifecycle-configuration': (c) => { const b = bkt(c); if (!b.lifecycle) c.fail('NoSuchLifecycleConfiguration', 'The lifecycle configuration does not exist'); return { Rules: b.lifecycle.Rules }; },
  'delete-bucket-lifecycle': (c) => { bkt(c).lifecycle = null; },
  'put-bucket-tagging': (c) => {
    const b = bkt(c), t = c.reqParam('tagging');
    if (!t || !Array.isArray(t.TagSet)) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
    b.tags = t.TagSet;
  },
  'get-bucket-tagging': (c) => { const b = bkt(c); if (!b.tags) c.fail('NoSuchTagSet', 'The TagSet does not exist'); return { TagSet: b.tags }; },
  'delete-bucket-tagging': (c) => { bkt(c).tags = null; },
  'put-bucket-encryption': (c) => {
    const b = bkt(c), cfg = c.reqParam('server-side-encryption-configuration');
    const rule = cfg && [].concat(cfg.Rules || [])[0];
    const alg = rule && rule.ApplyServerSideEncryptionByDefault && rule.ApplyServerSideEncryptionByDefault.SSEAlgorithm;
    if (!['AES256', 'aws:kms'].includes(alg)) c.fail('MalformedXML', 'The XML you provided was not well-formed or did not validate against our published schema');
    b.encryption = rule.ApplyServerSideEncryptionByDefault;
  },
  'get-bucket-encryption': (c) => ({ ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: bkt(c).encryption, BucketKeyEnabled: true }] } }),
};

module.exports = { ops };
void crypto; void parseParam;
