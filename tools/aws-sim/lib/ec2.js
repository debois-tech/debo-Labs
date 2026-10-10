// EC2: regions and zones, instances, security groups, key pairs, tags, and the default VPC (read-only).
const { hex, iso, parseShorthand } = require('./core');

const REGIONS = [
  ['us-east-1', 6], ['us-east-2', 3], ['us-west-1', 2], ['us-west-2', 4], ['eu-west-1', 3], ['eu-central-1', 3], ['ap-south-1', 3], ['ap-southeast-1', 3], ['ap-northeast-1', 3], ['sa-east-1', 3],
].map(([name, zones]) => ({ name, zones }));
const AMIS = { 'ami-0abcdef1234567890': 'Amazon Linux 2023', 'ami-0fedcba9876543210': 'Ubuntu Server 24.04 LTS' };
const TYPES = { 't2.micro': 0.0116, 't3.micro': 0.0104, 't3.small': 0.0208, 't3.medium': 0.0416, 'm5.large': 0.096, 'c5.large': 0.085, 'r5.large': 0.126 };
const CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

const regionObj = (c) => REGIONS.find((r) => r.name === c.region);
const zoneNames = (r) => Array.from({ length: r.zones }, (_, i) => r.name + 'abcdef'[i]);
const vpcId = (c) => 'vpc-' + hex(c.region + 'vpc', 17);
const defaultSg = (c) => 'sg-' + hex(c.region + 'default-sg', 17);
function ensureDefaultSg(c) {
  const id = defaultSg(c);
  if (!c.state.ec2.groups[id]) c.state.ec2.groups[id] = { GroupId: id, GroupName: 'default', Description: 'default VPC security group', VpcId: vpcId(c), region: c.region, ingress: [{ proto: '-1', from: -1, to: -1, cidr: id }], Tags: [] };
  return id;
}
function mustRegion(c) {
  if (!regionObj(c)) c.fail('InvalidRegion', `Could not connect to the endpoint URL: "https://ec2.${c.region}.amazonaws.com/"`, { exit: 255 });
}
const stateOf = (name) => ({ Code: { pending: 0, running: 16, 'shutting-down': 32, terminated: 48, stopping: 64, stopped: 80 }[name], Name: name });

function instanceView(i) {
  return {
    InstanceId: i.InstanceId, ImageId: i.ImageId, InstanceType: i.InstanceType, ...(i.KeyName ? { KeyName: i.KeyName } : {}), LaunchTime: i.LaunchTime,
    Placement: { AvailabilityZone: i.az, GroupName: '', Tenancy: 'default' }, PrivateIpAddress: i.PrivateIpAddress,
    ...(i.State.Name === 'running' ? { PublicIpAddress: i.PublicIpAddress } : {}),
    State: i.State, SubnetId: i.SubnetId, VpcId: i.VpcId, Architecture: 'x86_64',
    SecurityGroups: i.groupIds.map((g) => ({ GroupName: g.name, GroupId: g.id })), Tags: i.Tags,
  };
}
const tagValue = (o, k) => (o.Tags.find((t) => t.Key === k) || {}).Value;
const FILTERS = {
  'instance-state-name': (i) => i.State.Name, 'instance-type': (i) => i.InstanceType, 'instance-id': (i) => i.InstanceId, 'image-id': (i) => i.ImageId,
  'availability-zone': (i) => i.az, 'key-name': (i) => i.KeyName, 'tag-key': (i) => i.Tags.map((t) => t.Key),
};
function matchFilters(c, i, filters) {
  return filters.every((f) => {
    const vals = [].concat(f.Values || []);
    if (f.Name.startsWith('tag:')) return vals.includes(tagValue(i, f.Name.slice(4)));
    const getter = FILTERS[f.Name];
    if (!getter) c.fail('InvalidParameterValue', `The filter '${f.Name}' is invalid`);
    return [].concat(getter(i)).some((x) => vals.includes(x));
  });
}
const inRegion = (c) => Object.values(c.state.ec2.instances).filter((i) => i.region === c.region);
function pickInstances(c) {
  const ids = c.list('instance-ids');
  if (!ids.length) c.req('instance-ids');
  return ids.map((id) => {
    const i = c.state.ec2.instances[id];
    if (!i || i.region !== c.region) c.fail('InvalidInstanceID.NotFound', `The instance ID '${id}' does not exist`);
    return i;
  });
}
const portRule = (r) => ({
  IpProtocol: r.proto, ...(r.from !== -1 || r.proto !== '-1' ? { FromPort: r.from, ToPort: r.to } : {}),
  IpRanges: r.cidr.includes('/') ? [{ CidrIp: r.cidr }] : [], Ipv6Ranges: [], PrefixListIds: [], UserIdGroupPairs: r.cidr.includes('/') ? [] : [{ UserId: '123456789012', GroupId: r.cidr }],
});
const sgView = (g) => ({
  GroupId: g.GroupId, GroupName: g.GroupName, Description: g.Description, OwnerId: '123456789012', VpcId: g.VpcId, Tags: g.Tags,
  IpPermissions: g.ingress.map(portRule), IpPermissionsEgress: [{ IpProtocol: '-1', IpRanges: [{ CidrIp: '0.0.0.0/0' }], Ipv6Ranges: [], PrefixListIds: [], UserIdGroupPairs: [] }],
});
function parseRules(c) {
  if (c.has('ip-permissions')) {
    return c.paramList('ip-permissions').flatMap((p) => [].concat(p.IpRanges || []).map((r) => ({ proto: String(p.IpProtocol), from: Number(p.FromPort), to: Number(p.ToPort), cidr: r.CidrIp })));
  }
  const proto = c.req('protocol'), cidr = c.req('cidr');
  if (!CIDR.test(cidr) || cidr.split('/')[0].split('.').some((n) => Number(n) > 255) || Number(cidr.split('/')[1]) > 32) c.fail('InvalidParameterValue', `Value (${cidr}) for parameter cidrIp is invalid. This is not a valid CIDR block.`);
  if (!['tcp', 'udp', 'icmp', '-1', 'all'].includes(proto)) c.fail('InvalidParameterValue', `Invalid value '${proto}' for IP protocol.`);
  const port = proto === '-1' || proto === 'all' ? -1 : parseInt(c.req('port'), 10);
  if (proto !== '-1' && proto !== 'all' && !(port >= 0 && port <= 65535)) c.fail('InvalidParameterValue', `Invalid value '${c.flag('port')}' for portRange. Must be a valid port number.`);
  return [{ proto: proto === 'all' ? '-1' : proto, from: port, to: port, cidr }];
}
const ruleText = (r) => `peer: ${r.cidr}, ${r.proto === '-1' ? 'ALL' : r.proto.toUpperCase()}, from port: ${r.from}, to port: ${r.to}, ALLOW`;
const sameRule = (a, b) => a.proto === b.proto && a.from === b.from && a.to === b.to && a.cidr === b.cidr;
const needSg = (c, id) => {
  const g = c.state.ec2.groups[id];
  if (!g || g.region !== c.region) c.fail('InvalidGroup.NotFound', `The security group '${id}' does not exist`);
  return g;
};
const dryRun = (c) => { if (c.bool('dry-run')) c.fail('DryRunOperation', 'Request would have succeeded, but DryRun flag is set.'); };

const ops = {
  'describe-regions': (c) => {
    const names = c.list('region-names');
    return { Regions: REGIONS.filter((r) => !names.length || names.includes(r.name)).map((r) => ({ Endpoint: `ec2.${r.name}.amazonaws.com`, RegionName: r.name, OptInStatus: 'opt-in-not-required' })) };
  },
  'describe-availability-zones': (c) => {
    mustRegion(c);
    const r = regionObj(c);
    return { AvailabilityZones: zoneNames(r).map((z, i) => ({ State: 'available', OptInStatus: 'opt-in-not-required', Messages: [], RegionName: r.name, ZoneName: z, ZoneId: `${r.name.slice(0, 3)}${i + 1}-az${i + 1}`, GroupName: r.name, NetworkBorderGroup: r.name, ZoneType: 'availability-zone' })) };
  },
  'describe-vpcs': (c) => { mustRegion(c); return { Vpcs: [{ CidrBlock: '172.31.0.0/16', DhcpOptionsId: 'dopt-' + hex(c.region, 8), State: 'available', VpcId: vpcId(c), OwnerId: c.account, InstanceTenancy: 'default', IsDefault: true }] }; },
  'describe-subnets': (c) => {
    mustRegion(c);
    return { Subnets: zoneNames(regionObj(c)).map((z, i) => ({ AvailabilityZone: z, AvailableIpAddressCount: 4091, CidrBlock: `172.31.${i * 16}.0/20`, DefaultForAz: true, MapPublicIpOnLaunch: true, State: 'available', SubnetId: 'subnet-' + hex(z, 17), VpcId: vpcId(c) })) };
  },
  'run-instances': (c) => {
    mustRegion(c);
    const ami = c.req('image-id'), type = c.flag('instance-type') || 'm1.small';
    if (!AMIS[ami]) c.fail('InvalidAMIID.NotFound', `The image id '[${ami}]' does not exist`);
    if (!TYPES[type]) c.fail('InvalidParameterValue', `Invalid value '${type}' for instanceType.`);
    const count = parseInt(c.flag('count') || '1', 10);
    if (!(count >= 1 && count <= 20)) c.fail('InstanceLimitExceeded', 'You have requested more instances than your current instance limit allows for the specified instance type.');
    if (c.flag('key-name') && !c.state.ec2.keyPairs[c.flag('key-name')]) c.fail('InvalidKeyPair.NotFound', `The key pair '${c.flag('key-name')}' does not exist`);
    const gids = c.list('security-group-ids');
    const groups = (gids.length ? gids : [ensureDefaultSg(c)]).map((id) => needSg(c, id));
    const specs = c.paramList('tag-specifications').filter((s) => s.ResourceType === 'instance');
    const tags = specs.flatMap((s) => [].concat(s.Tags || []));
    const placement = c.has('placement') ? c.param('placement') : {};
    const az = (placement && placement.AvailabilityZone) || zoneNames(regionObj(c))[0];
    if (!zoneNames(regionObj(c)).includes(az)) c.fail('InvalidParameterValue', `Value (${az}) for parameter availabilityZone is invalid. Subnets can currently only be created in the following availability zones: ${zoneNames(regionObj(c)).join(', ')}.`);
    dryRun(c);
    const rsv = 'r-' + hex(c.state.counter + 'r', 17);
    const made = [];
    for (let n = 0; n < count; n++) {
      const id = c.id('i-0');
      const octet = (c.state.counter % 200) + 10;
      c.state.ec2.instances[id] = {
        InstanceId: id, region: c.region, az, ImageId: ami, InstanceType: type, KeyName: c.flag('key-name'), LaunchTime: iso(), State: stateOf('running'),
        PrivateIpAddress: `172.31.${Math.floor(octet / 20)}.${octet}`, PublicIpAddress: `54.${octet}.${(octet * 7) % 250}.${(octet * 13) % 250}`, SubnetId: 'subnet-' + hex(az, 17), VpcId: vpcId(c),
        groupIds: groups.map((g) => ({ id: g.GroupId, name: g.GroupName })), Tags: tags, reservation: rsv,
      };
      made.push(c.state.ec2.instances[id]);
    }
    return { Groups: [], Instances: made.map((i) => ({ ...instanceView(i), State: stateOf('pending') })), OwnerId: c.account, ReservationId: rsv };
  },
  'describe-instances': (c) => {
    mustRegion(c);
    const ids = c.list('instance-ids');
    ids.forEach((id) => { if (!c.state.ec2.instances[id] || c.state.ec2.instances[id].region !== c.region) c.fail('InvalidInstanceID.NotFound', `The instance ID '${id}' does not exist`); });
    const filters = c.paramList('filters');
    const list = inRegion(c).filter((i) => (!ids.length || ids.includes(i.InstanceId)) && matchFilters(c, i, filters));
    const byRes = {};
    for (const i of list) (byRes[i.reservation] = byRes[i.reservation] || []).push(i);
    return { Reservations: Object.entries(byRes).map(([id, is]) => ({ Groups: [], Instances: is.map(instanceView), OwnerId: c.account, ReservationId: id })) };
  },
  'stop-instances': (c) => {
    const list = pickInstances(c);
    dryRun(c);
    return { StoppingInstances: list.map((i) => {
      const prev = i.State;
      if (i.State.Name !== 'running') c.fail('IncorrectInstanceState', `The instance '${i.InstanceId}' is not in a state from which it can be stopped.`);
      i.State = stateOf('stopped');
      return { InstanceId: i.InstanceId, CurrentState: stateOf('stopping'), PreviousState: prev };
    }) };
  },
  'start-instances': (c) => {
    const list = pickInstances(c);
    dryRun(c);
    return { StartingInstances: list.map((i) => {
      const prev = i.State;
      if (i.State.Name !== 'stopped') c.fail('IncorrectInstanceState', `The instance '${i.InstanceId}' is not in a state from which it can be started.`);
      i.State = stateOf('running');
      return { InstanceId: i.InstanceId, CurrentState: stateOf('pending'), PreviousState: prev };
    }) };
  },
  'terminate-instances': (c) => {
    const list = pickInstances(c);
    dryRun(c);
    return { TerminatingInstances: list.map((i) => {
      const prev = i.State;
      i.State = stateOf('terminated');
      return { InstanceId: i.InstanceId, CurrentState: stateOf('shutting-down'), PreviousState: prev };
    }) };
  },
  'create-security-group': (c) => {
    mustRegion(c);
    const name = c.req('group-name'), desc = c.req('description');
    if (/^sg-/.test(name)) c.fail('InvalidGroup.Reserved', `Group name '${name}' is reserved.`);
    ensureDefaultSg(c);
    if (Object.values(c.state.ec2.groups).some((g) => g.region === c.region && g.GroupName === name)) c.fail('InvalidGroup.Duplicate', `The security group '${name}' already exists for VPC '${vpcId(c)}'`);
    const id = 'sg-' + hex(c.state.counter++ + name, 17);
    c.state.ec2.groups[id] = { GroupId: id, GroupName: name, Description: desc, VpcId: c.flag('vpc-id') || vpcId(c), region: c.region, ingress: [], Tags: [] };
    return { GroupId: id };
  },
  'describe-security-groups': (c) => {
    mustRegion(c);
    ensureDefaultSg(c);
    const ids = c.list('group-ids'), names = c.list('group-names'), filters = c.paramList('filters');
    ids.forEach((id) => needSg(c, id));
    return { SecurityGroups: Object.values(c.state.ec2.groups).filter((g) => g.region === c.region && (!ids.length || ids.includes(g.GroupId)) && (!names.length || names.includes(g.GroupName))
      && filters.every((f) => (f.Name === 'group-name' ? [].concat(f.Values).includes(g.GroupName) : f.Name === 'group-id' ? [].concat(f.Values).includes(g.GroupId) : true))).map(sgView) };
  },
  'authorize-security-group-ingress': (c) => {
    const g = needSg(c, c.req('group-id'));
    const rules = parseRules(c);
    dryRun(c);
    for (const r of rules) {
      if (g.ingress.some((x) => sameRule(x, r))) c.fail('InvalidPermission.Duplicate', `the specified rule "${ruleText(r)}" already exists`);
      g.ingress.push(r);
    }
    return { Return: true, SecurityGroupRules: rules.map((r) => ({ SecurityGroupRuleId: 'sgr-' + hex(g.GroupId + ruleText(r), 17), GroupId: g.GroupId, GroupOwnerId: c.account, IsEgress: false, IpProtocol: r.proto, FromPort: r.from, ToPort: r.to, CidrIpv4: r.cidr })) };
  },
  'revoke-security-group-ingress': (c) => {
    const g = needSg(c, c.req('group-id'));
    const rules = parseRules(c);
    for (const r of rules) {
      if (!g.ingress.some((x) => sameRule(x, r))) c.fail('InvalidPermission.NotFound', 'The specified rule does not exist in this security group.');
      g.ingress = g.ingress.filter((x) => !sameRule(x, r));
    }
    return { Return: true };
  },
  'delete-security-group': (c) => {
    const id = c.flag('group-id') || (c.flag('group-name') && Object.values(c.state.ec2.groups).find((g) => g.GroupName === c.flag('group-name') && g.region === c.region) || {}).GroupId;
    if (!id) c.req('group-id');
    const g = needSg(c, id);
    if (g.GroupName === 'default') c.fail('CannotDelete', 'the specified group: "' + id + '" name: "default" cannot be deleted by a user');
    if (inRegion(c).some((i) => i.State.Name !== 'terminated' && i.groupIds.some((x) => x.id === id))) c.fail('DependencyViolation', `resource ${id} has a dependent object`);
    delete c.state.ec2.groups[id];
  },
  'create-key-pair': (c) => {
    mustRegion(c);
    const name = c.req('key-name');
    if (c.state.ec2.keyPairs[name]) c.fail('InvalidKeyPair.Duplicate', `The keypair '${name}' already exists.`);
    const fp = hex(name, 40).match(/../g).join(':');
    c.state.ec2.keyPairs[name] = { KeyName: name, KeyPairId: 'key-' + hex(name, 17), KeyFingerprint: fp };
    const body = Buffer.from(hex(name + 'material', 40).repeat(8)).toString('base64').match(/.{1,64}/g).join('\n');
    return { KeyFingerprint: fp, KeyMaterial: `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`, KeyName: name, KeyPairId: c.state.ec2.keyPairs[name].KeyPairId };
  },
  'describe-key-pairs': (c) => ({ KeyPairs: Object.values(c.state.ec2.keyPairs) }),
  'delete-key-pair': (c) => { delete c.state.ec2.keyPairs[c.req('key-name')]; },
  'create-tags': (c) => {
    const res = c.list('resources');
    if (!res.length) c.req('resources');
    const tags = c.paramList('tags');
    if (!tags.length) c.req('tags');
    for (const id of res) {
      const o = c.state.ec2.instances[id] || c.state.ec2.groups[id];
      if (!o) c.fail('InvalidID', `The ID '${id}' is not valid`);
      for (const t of tags) { const ex = o.Tags.find((x) => x.Key === t.Key); if (ex) ex.Value = t.Value || ''; else o.Tags.push({ Key: t.Key, Value: t.Value || '' }); }
    }
  },
};

module.exports = { ops, TYPES, parseShorthand };
