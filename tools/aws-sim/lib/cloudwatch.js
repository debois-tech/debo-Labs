// CloudWatch alarms and metric names
const { iso } = require('./core');
const OPERATORS = ['GreaterThanOrEqualToThreshold', 'GreaterThanThreshold', 'LessThanThreshold', 'LessThanOrEqualToThreshold'];
const STATS = ['SampleCount', 'Average', 'Sum', 'Minimum', 'Maximum'];

const view = (c, a) => ({
  AlarmName: a.AlarmName, AlarmArn: `arn:aws:cloudwatch:${a.region}:${c.account}:alarm:${a.AlarmName}`, AlarmDescription: a.AlarmDescription, AlarmConfigurationUpdatedTimestamp: a.updated,
  ActionsEnabled: true, OKActions: [], AlarmActions: a.AlarmActions, InsufficientDataActions: [], StateValue: a.StateValue, StateReason: a.StateReason, StateUpdatedTimestamp: a.updated,
  MetricName: a.MetricName, Namespace: a.Namespace, Statistic: a.Statistic, Dimensions: a.Dimensions, Period: a.Period, EvaluationPeriods: a.EvaluationPeriods, Threshold: a.Threshold, ComparisonOperator: a.ComparisonOperator,
});
const ops = {
  'put-metric-alarm': (c) => {
    const a = { AlarmName: c.req('alarm-name'), region: c.region, updated: iso() };
    a.ComparisonOperator = c.req('comparison-operator');
    if (!OPERATORS.includes(a.ComparisonOperator)) c.fail('ValidationError', `Value '${a.ComparisonOperator}' at 'comparisonOperator' failed to satisfy constraint: Member must satisfy enum value set: [${OPERATORS.join(', ')}]`);
    a.EvaluationPeriods = parseInt(c.req('evaluation-periods'), 10);
    a.MetricName = c.req('metric-name'); a.Namespace = c.req('namespace'); a.Period = parseInt(c.req('period'), 10);
    a.Statistic = c.req('statistic');
    if (!STATS.includes(a.Statistic)) c.fail('ValidationError', `Value '${a.Statistic}' at 'statistic' failed to satisfy constraint: Member must satisfy enum value set: [${STATS.join(', ')}]`);
    a.Threshold = parseFloat(c.req('threshold'));
    if (!(a.Period >= 10 && (a.Period < 60 || a.Period % 60 === 0))) c.fail('InvalidParameterValue', 'Period must be 10, 30 or a multiple of 60.');
    a.Dimensions = c.paramList('dimensions');
    a.AlarmActions = c.list('alarm-actions');
    a.AlarmDescription = c.flag('alarm-description');
    a.StateValue = 'INSUFFICIENT_DATA'; a.StateReason = 'Unchecked: Initial alarm creation';
    c.state.cloudwatch.alarms[`${c.region}/${a.AlarmName}`] = a;
  },
  'describe-alarms': (c) => {
    const names = c.list('alarm-names'), st = c.flag('state-value');
    const list = Object.values(c.state.cloudwatch.alarms).filter((a) => a.region === c.region && (!names.length || names.includes(a.AlarmName)) && (!st || a.StateValue === st));
    return { MetricAlarms: list.map((a) => view(c, a)), CompositeAlarms: [] };
  },
  'set-alarm-state': (c) => {
    const a = c.state.cloudwatch.alarms[`${c.region}/${c.req('alarm-name')}`];
    if (!a) c.fail('ResourceNotFound', `Alarm ${c.flag('alarm-name')} does not exist`);
    const v = c.req('state-value');
    if (!['OK', 'ALARM', 'INSUFFICIENT_DATA'].includes(v)) c.fail('ValidationError', `Value '${v}' at 'stateValue' failed to satisfy constraint: Member must satisfy enum value set: [INSUFFICIENT_DATA, ALARM, OK]`);
    a.StateValue = v; a.StateReason = c.req('state-reason'); a.updated = iso();
  },
  'delete-alarms': (c) => {
    const names = c.list('alarm-names');
    if (!names.length) c.req('alarm-names');
    for (const n of names) delete c.state.cloudwatch.alarms[`${c.region}/${n}`];
  },
  'list-metrics': (c) => {
    const ns = c.flag('namespace');
    const running = Object.values(c.state.ec2.instances).filter((i) => i.region === c.region && i.State.Name === 'running');
    const metrics = ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadOps', 'StatusCheckFailed'];
    const all = running.flatMap((i) => metrics.map((m) => ({ Namespace: 'AWS/EC2', MetricName: m, Dimensions: [{ Name: 'InstanceId', Value: i.InstanceId }] })));
    return { Metrics: all.filter((m) => (!ns || m.Namespace === ns) && (!c.flag('metric-name') || m.MetricName === c.flag('metric-name'))) };
  },
};
module.exports = { ops };
