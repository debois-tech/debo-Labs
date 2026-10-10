// IAM: users, groups, roles, managed policies, access keys, the account password policy, and a policy evaluator
// (simulate-principal-policy) that follows the real order: explicit Deny beats Allow beats the default implicit deny.
const { hex, upper, iso, parseParam } = require('./core');

const AWS_POLICY = (name, actions, path = '/') => ({ name, path, doc: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: actions, Resource: '*' }] } });
const AWS_MANAGED = Object.fromEntries([
  AWS_POLICY('AdministratorAccess', '*'),
  AWS_POLICY('ReadOnlyAccess', ['*:Get*', '*:List*', '*:Describe*']),
  AWS_POLICY('PowerUserAccess', ['*']),
  AWS_POLICY('AmazonS3FullAccess', ['s3:*', 's3-object-lambda:*']),
  AWS_POLICY('AmazonS3ReadOnlyAccess', ['s3:Get*', 's3:List*', 's3-object-lambda:Get*', 's3-object-lambda:List*']),
  AWS_POLICY('AmazonEC2FullAccess', ['ec2:*', 'elasticloadbalancing:*', 'cloudwatch:*', 'autoscaling:*']),
  AWS_POLICY('AmazonEC2ReadOnlyAccess', ['ec2:Describe*', 'elasticloadbalancing:Describe*', 'cloudwatch:Describe*', 'cloudwatch:List*', 'cloudwatch:Get*', 'autoscaling:Describe*']),
  AWS_POLICY('IAMReadOnlyAccess', ['iam:Get*', 'iam:List*', 'iam:Generate*', 'iam:Simulate*']),
  AWS_POLICY('IAMFullAccess', ['iam:*']),
  AWS_POLICY('CloudWatchReadOnlyAccess', ['cloudwatch:Describe*', 'cloudwatch:Get*', 'cloudwatch:List*', 'logs:Describe*', 'logs:Get*']),
  AWS_POLICY('Billing', ['aws-portal:*', 'ce:*', 'budgets:*', 'billing:*'], '/job-function/'),
].map((p) => [`arn:aws:iam::aws:policy${p.path}${p.name}`, p]));

const arnOf = (c, kind, name, path = '/') => `arn:aws:iam::${c.account}:${kind}${path}${name}`;
const nowIso = () => iso();
const tagsOf = (c) => (c.has('tags') ? c.paramList('tags') : []);

function policyDoc(c, flagName) {
  const v = c.req(flagName);
  const doc = c.param(flagName);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) c.fail('MalformedPolicyDocument', 'Syntax errors in policy.');
  if (!doc.Statement) c.fail('MalformedPolicyDocument', 'Syntax errors in policy.');
  const stmts = [].concat(doc.Statement);
  for (const s of stmts) {
    if (!['Allow', 'Deny'].includes(s.Effect)) c.fail('MalformedPolicyDocument', 'Syntax errors in policy.');
    if (!s.Action && !s.NotAction) c.fail('MalformedPolicyDocument', 'Syntax errors in policy.');
  }
  void v;
  return doc;
}

function allPolicies(c) {
  const out = { ...Object.fromEntries(Object.entries(AWS_MANAGED).map(([arn, p]) => [arn, { arn, name: p.name, path: p.path, doc: p.doc, aws: true }])) };
  for (const [arn, p] of Object.entries(c.state.iam.policies)) out[arn] = { arn, name: p.PolicyName, path: p.Path, doc: p.Document, aws: false };
  return out;
}
const policyView = (c, p) => {
  const attached = (m) => Object.values(m).reduce((n, list) => n + list.filter((a) => a === p.arn).length, 0);
  const local = c.state.iam.policies[p.arn];
  return {
    PolicyName: p.name, PolicyId: local ? local.PolicyId : 'ANPA' + upper(hex(p.arn, 17)), Arn: p.arn, Path: p.path,
    DefaultVersionId: 'v1', AttachmentCount: attached(c.state.iam.userPolicies) + attached(c.state.iam.groupPolicies) + attached(c.state.iam.rolePolicies),
    PermissionsBoundaryUsageCount: 0, IsAttachable: true, CreateDate: local ? local.CreateDate : '2015-02-06T18:39:46+00:00', UpdateDate: local ? local.CreateDate : '2015-02-06T18:39:46+00:00',
  };
};

// ---- the evaluator ------------------------------------------------------------------------------------------------
const glob = (pattern) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
const asList = (x) => (x === undefined ? [] : [].concat(x));
function stmtMatches(stmt, action, resource) {
  if (stmt.Condition) return false;                       // conditions are not simulated: a statement with one never matches
  const actions = asList(stmt.Action), not = asList(stmt.NotAction);
  const aHit = actions.length ? actions.some((p) => glob(p).test(action)) : !not.some((p) => glob(p).test(action));
  if (!aHit) return false;
  const res = asList(stmt.Resource || '*');
  return res.some((p) => glob(p).test(resource));
}
function evaluate(docs, action, resource) {
  let allowed = false;
  for (const d of docs) {
    for (const s of asList(d.Statement)) {
      if (!stmtMatches(s, action, resource)) continue;
      if (s.Effect === 'Deny') return 'explicitDeny';
      if (s.Effect === 'Allow') allowed = true;
    }
  }
  return allowed ? 'allowed' : 'implicitDeny';
}
function docsForPrincipal(c, arn) {
  const pols = allPolicies(c);
  const m = arn.match(/:(user|role|group)\/(.+)$/);
  if (!m) c.fail('InvalidInput', `Invalid ARN: ${arn}`);
  const [, kind, name] = m;
  const base = name.split('/').pop();
  const lists = [];
  if (kind === 'user') {
    if (!c.state.iam.users[base]) c.fail('NoSuchEntity', `The user with name ${base} cannot be found.`);
    lists.push(...(c.state.iam.userPolicies[base] || []));
    for (const g of c.state.iam.memberships[base] || []) lists.push(...(c.state.iam.groupPolicies[g] || []));
  } else if (kind === 'role') {
    if (!c.state.iam.roles[base]) c.fail('NoSuchEntity', `The role with name ${base} cannot be found.`);
    lists.push(...(c.state.iam.rolePolicies[base] || []));
  } else lists.push(...(c.state.iam.groupPolicies[base] || []));
  return lists.map((a) => pols[a] && pols[a].doc).filter(Boolean);
}

const userView = (c, u) => ({ Path: '/', UserName: u.UserName, UserId: u.UserId, Arn: arnOf(c, 'user', u.UserName), CreateDate: u.CreateDate, ...(u.Tags && u.Tags.length ? { Tags: u.Tags } : {}) });
const groupView = (c, g) => ({ Path: '/', GroupName: g.GroupName, GroupId: g.GroupId, Arn: arnOf(c, 'group', g.GroupName), CreateDate: g.CreateDate });
const roleView = (c, r) => ({ Path: '/', RoleName: r.RoleName, RoleId: r.RoleId, Arn: arnOf(c, 'role', r.RoleName), CreateDate: r.CreateDate, AssumeRolePolicyDocument: r.AssumeRolePolicyDocument, MaxSessionDuration: 3600 });

const exists = (c, kind, label, name) => c.fail('NoSuchEntity', `The ${label} with name ${name} cannot be found.`, { op: kind });
function need(c, map, name, label) { if (!map[name]) c.fail('NoSuchEntity', `The ${label} with name ${name} cannot be found.`); return map[name]; }

const attach = (store, labelMap, label) => ({
  [`attach-${label}-policy`]: (c) => {
    const name = c.req(`${label}-name`.replace('role-name', 'role-name')), arn = c.req('policy-arn');
    need(c, labelMap(c), name, label);
    if (!allPolicies(c)[arn]) c.fail('NoSuchEntity', `Policy ${arn} does not exist or is not attachable.`);
    store(c)[name] = store(c)[name] || [];
    if (!store(c)[name].includes(arn)) store(c)[name].push(arn);
  },
  [`detach-${label}-policy`]: (c) => {
    const name = c.req(`${label}-name`), arn = c.req('policy-arn');
    need(c, labelMap(c), name, label);
    const list = store(c)[name] || [];
    if (!list.includes(arn)) c.fail('NoSuchEntity', `Policy ${arn} was not found.`);
    store(c)[name] = list.filter((a) => a !== arn);
  },
  [`list-attached-${label}-policies`]: (c) => {
    const name = c.req(`${label}-name`);
    need(c, labelMap(c), name, label);
    const pols = allPolicies(c);
    return { AttachedPolicies: (store(c)[name] || []).map((a) => ({ PolicyName: pols[a].name, PolicyArn: a })), IsTruncated: false };
  },
});

const ops = {
  // users
  'create-user': (c) => {
    const name = c.req('user-name');
    if (!/^[\w+=,.@-]{1,64}$/.test(name)) c.fail('ValidationError', `1 validation error detected: Value '${name}' at 'userName' failed to satisfy constraint: Member must satisfy regular expression pattern: [\\w+=,.@-]+`);
    if (c.state.iam.users[name]) c.fail('EntityAlreadyExists', `User with name ${name} already exists.`);
    c.state.iam.users[name] = { UserName: name, UserId: 'AIDA' + upper(hex(name + c.state.counter++, 17)), CreateDate: nowIso(), Tags: tagsOf(c) };
    return { User: userView(c, c.state.iam.users[name]) };
  },
  'get-user': (c) => {
    const name = c.flag('user-name') || 'learner';
    return { User: userView(c, need(c, c.state.iam.users, name, 'user')) };
  },
  'list-users': (c) => ({ Users: Object.values(c.state.iam.users).map((u) => userView(c, u)) }),
  'delete-user': (c) => {
    const name = c.req('user-name');
    need(c, c.state.iam.users, name, 'user');
    if ((c.state.iam.memberships[name] || []).length) c.fail('DeleteConflict', 'Cannot delete entity, must remove users from groups first.');
    if ((c.state.iam.userPolicies[name] || []).length) c.fail('DeleteConflict', 'Cannot delete entity, must detach all policies first.');
    if (Object.values(c.state.iam.accessKeys).some((k) => k.UserName === name)) c.fail('DeleteConflict', 'Cannot delete entity, must delete access keys first.');
    delete c.state.iam.users[name];
    delete c.state.iam.memberships[name];
    delete c.state.iam.userPolicies[name];
  },
  // groups
  'create-group': (c) => {
    const name = c.req('group-name');
    if (c.state.iam.groups[name]) c.fail('EntityAlreadyExists', `Group with name ${name} already exists.`);
    c.state.iam.groups[name] = { GroupName: name, GroupId: 'AGPA' + upper(hex(name + c.state.counter++, 17)), CreateDate: nowIso() };
    return { Group: groupView(c, c.state.iam.groups[name]) };
  },
  'list-groups': (c) => ({ Groups: Object.values(c.state.iam.groups).map((g) => groupView(c, g)) }),
  'get-group': (c) => {
    const name = c.req('group-name');
    const g = need(c, c.state.iam.groups, name, 'group');
    const users = Object.entries(c.state.iam.memberships).filter(([, gs]) => gs.includes(name)).map(([u]) => userView(c, c.state.iam.users[u]));
    return { Users: users, Group: groupView(c, g), IsTruncated: false };
  },
  'add-user-to-group': (c) => {
    const g = c.req('group-name'), u = c.req('user-name');
    need(c, c.state.iam.groups, g, 'group'); need(c, c.state.iam.users, u, 'user');
    c.state.iam.memberships[u] = c.state.iam.memberships[u] || [];
    if (!c.state.iam.memberships[u].includes(g)) c.state.iam.memberships[u].push(g);
  },
  'remove-user-from-group': (c) => {
    const g = c.req('group-name'), u = c.req('user-name');
    need(c, c.state.iam.groups, g, 'group'); need(c, c.state.iam.users, u, 'user');
    c.state.iam.memberships[u] = (c.state.iam.memberships[u] || []).filter((x) => x !== g);
  },
  'list-groups-for-user': (c) => {
    const u = c.req('user-name');
    need(c, c.state.iam.users, u, 'user');
    return { Groups: (c.state.iam.memberships[u] || []).map((g) => groupView(c, c.state.iam.groups[g])) };
  },
  'delete-group': (c) => {
    const g = c.req('group-name');
    need(c, c.state.iam.groups, g, 'group');
    if (Object.values(c.state.iam.memberships).some((gs) => gs.includes(g))) c.fail('DeleteConflict', 'Cannot delete entity, must remove users from group first.');
    if ((c.state.iam.groupPolicies[g] || []).length) c.fail('DeleteConflict', 'Cannot delete entity, must detach all policies first.');
    delete c.state.iam.groups[g];
  },
  // roles
  'create-role': (c) => {
    const name = c.req('role-name');
    const doc = policyDoc(c, 'assume-role-policy-document');
    if (c.state.iam.roles[name]) c.fail('EntityAlreadyExists', `Role with name ${name} already exists.`);
    c.state.iam.roles[name] = { RoleName: name, RoleId: 'AROA' + upper(hex(name + c.state.counter++, 17)), CreateDate: nowIso(), AssumeRolePolicyDocument: doc };
    return { Role: roleView(c, c.state.iam.roles[name]) };
  },
  'get-role': (c) => ({ Role: roleView(c, need(c, c.state.iam.roles, c.req('role-name'), 'role')) }),
  'list-roles': (c) => ({ Roles: Object.values(c.state.iam.roles).map((r) => roleView(c, r)) }),
  'delete-role': (c) => {
    const n = c.req('role-name');
    need(c, c.state.iam.roles, n, 'role');
    if ((c.state.iam.rolePolicies[n] || []).length) c.fail('DeleteConflict', 'Cannot delete entity, must detach all policies first.');
    delete c.state.iam.roles[n];
  },
  // managed policies
  'create-policy': (c) => {
    const name = c.req('policy-name');
    const doc = policyDoc(c, 'policy-document');
    const arn = arnOf(c, 'policy', name);
    if (c.state.iam.policies[arn]) c.fail('EntityAlreadyExists', `A policy called ${name} already exists. Duplicate names are not allowed.`);
    c.state.iam.policies[arn] = { PolicyName: name, PolicyId: 'ANPA' + upper(hex(name + c.state.counter++, 17)), Path: '/', Document: doc, CreateDate: nowIso() };
    return { Policy: policyView(c, allPolicies(c)[arn]) };
  },
  'get-policy': (c) => {
    const arn = c.req('policy-arn');
    const p = allPolicies(c)[arn];
    if (!p) c.fail('NoSuchEntity', `Policy ${arn} was not found.`);
    return { Policy: policyView(c, p) };
  },
  'get-policy-version': (c) => {
    const arn = c.req('policy-arn');
    const p = allPolicies(c)[arn];
    if (!p) c.fail('NoSuchEntity', `Policy ${arn} was not found.`);
    return { PolicyVersion: { Document: p.doc, VersionId: c.flag('version-id') || 'v1', IsDefaultVersion: true, CreateDate: '2015-02-06T18:39:46+00:00' } };
  },
  'list-policies': (c) => {
    const scope = c.flag('scope') || 'All';
    let list = Object.values(allPolicies(c)).filter((p) => scope === 'All' || (scope === 'AWS' ? p.aws : !p.aws));
    if (c.bool('only-attached')) list = list.filter((p) => policyView(c, p).AttachmentCount > 0);
    return { Policies: list.map((p) => policyView(c, p)) };
  },
  'delete-policy': (c) => {
    const arn = c.req('policy-arn');
    if (!c.state.iam.policies[arn]) c.fail('NoSuchEntity', `Policy ${arn} was not found.`);
    if (policyView(c, allPolicies(c)[arn]).AttachmentCount > 0) c.fail('DeleteConflict', 'Cannot delete a policy attached to entities.');
    delete c.state.iam.policies[arn];
  },
  ...attach((c) => c.state.iam.userPolicies, (c) => c.state.iam.users, 'user'),
  ...attach((c) => c.state.iam.groupPolicies, (c) => c.state.iam.groups, 'group'),
  ...attach((c) => c.state.iam.rolePolicies, (c) => c.state.iam.roles, 'role'),
  // access keys
  'create-access-key': (c) => {
    const u = c.flag('user-name') || 'learner';
    need(c, c.state.iam.users, u, 'user');
    if (Object.values(c.state.iam.accessKeys).filter((k) => k.UserName === u).length >= 2) c.fail('LimitExceeded', 'Cannot exceed quota for AccessKeysPerUser: 2');
    const id = 'AKIA' + upper(hex(u + c.state.counter++, 16));
    c.state.iam.accessKeys[id] = { UserName: u, AccessKeyId: id, Status: 'Active', CreateDate: nowIso() };
    return { AccessKey: { ...c.state.iam.accessKeys[id], SecretAccessKey: hex('secret' + id, 40) } };
  },
  'list-access-keys': (c) => {
    const u = c.flag('user-name') || 'learner';
    return { AccessKeyMetadata: Object.values(c.state.iam.accessKeys).filter((k) => k.UserName === u) };
  },
  'update-access-key': (c) => {
    const id = c.req('access-key-id'), st = c.req('status');
    if (!['Active', 'Inactive'].includes(st)) c.fail('ValidationError', `Value '${st}' at 'status' failed to satisfy constraint: Member must satisfy enum value set: [Active, Inactive]`);
    if (!c.state.iam.accessKeys[id]) c.fail('NoSuchEntity', `The Access Key with id ${id} cannot be found.`);
    c.state.iam.accessKeys[id].Status = st;
  },
  'delete-access-key': (c) => {
    const id = c.req('access-key-id');
    if (!c.state.iam.accessKeys[id]) c.fail('NoSuchEntity', `The Access Key with id ${id} cannot be found.`);
    delete c.state.iam.accessKeys[id];
  },
  // account password policy
  'update-account-password-policy': (c) => {
    const p = c.state.iam.passwordPolicy || { MinimumPasswordLength: 8, RequireSymbols: false, RequireNumbers: false, RequireUppercaseCharacters: false, RequireLowercaseCharacters: false, AllowUsersToChangePassword: false, ExpirePasswords: false, HardExpiry: false };
    if (c.has('minimum-password-length')) p.MinimumPasswordLength = parseInt(c.flag('minimum-password-length'), 10);
    for (const [flag, key] of [['require-symbols', 'RequireSymbols'], ['require-numbers', 'RequireNumbers'], ['require-uppercase-characters', 'RequireUppercaseCharacters'], ['require-lowercase-characters', 'RequireLowercaseCharacters'], ['allow-users-to-change-password', 'AllowUsersToChangePassword']]) {
      if (c.has(flag)) p[key] = true;
      if (c.has('no-' + flag)) p[key] = false;
    }
    if (c.has('max-password-age')) { p.MaxPasswordAge = parseInt(c.flag('max-password-age'), 10); p.ExpirePasswords = p.MaxPasswordAge > 0; }
    if (c.has('password-reuse-prevention')) p.PasswordReusePrevention = parseInt(c.flag('password-reuse-prevention'), 10);
    if (!(p.MinimumPasswordLength >= 6 && p.MinimumPasswordLength <= 128)) c.fail('ValidationError', 'Minimum password length must be between 6 and 128.');
    c.state.iam.passwordPolicy = p;
  },
  'get-account-password-policy': (c) => {
    if (!c.state.iam.passwordPolicy) c.fail('NoSuchEntity', `The Password Policy with domain name ${c.account} cannot be found.`);
    return { PasswordPolicy: c.state.iam.passwordPolicy };
  },
  // does this principal's policy allow this action?
  'simulate-principal-policy': (c) => {
    const arn = c.req('policy-source-arn');
    const actions = c.list('action-names');
    if (!actions.length) c.req('action-names');
    const resources = c.list('resource-arns');
    const docs = docsForPrincipal(c, arn);
    const results = [];
    for (const a of actions) {
      for (const r of (resources.length ? resources : ['*'])) {
        results.push({ EvalActionName: a, EvalResourceName: r, EvalDecision: evaluate(docs, a, r), MatchedStatements: [], MissingContextValues: [] });
      }
    }
    return { EvaluationResults: results, IsTruncated: false };
  },
};

module.exports = { ops, AWS_MANAGED, evaluate };
void parseParam;
void exists;
