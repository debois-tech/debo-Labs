// Cost Explorer with SIMULATED numbers: every running instance is assumed to run all day, every day of the period.
const { TYPES } = require('./ec2');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (s) => new Date(s + 'T00:00:00Z');
const fmt = (d) => d.toISOString().slice(0, 10);
const money = (n) => (Math.round(n * 1e10) / 1e10).toString();

function periods(start, end, granularity) {
  const out = [];
  let a = day(start);
  const stop = day(end);
  while (a < stop) {
    let b;
    if (granularity === 'DAILY') b = new Date(a.getTime() + 86400000);
    else b = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
    if (b > stop) b = stop;
    out.push([fmt(a), fmt(b), Math.round((b - a) / 86400000)]);
    a = b;
  }
  return out;
}
function costs(c, days) {
  const parts = {};
  const add = (svc, tagVal, amt) => { parts[svc] = parts[svc] || { total: 0, tags: {} }; parts[svc].total += amt; parts[svc].tags[tagVal] = (parts[svc].tags[tagVal] || 0) + amt; };
  const key = c.has('group-by') ? c.paramList('group-by').find((g) => g.Type === 'TAG') : null;
  for (const i of Object.values(c.state.ec2.instances).filter((x) => x.State.Name === 'running')) {
    const tag = key ? ((i.Tags.find((t) => t.Key === key.Key) || {}).Value || '') : '';
    add('Amazon Elastic Compute Cloud - Compute', tag, (TYPES[i.InstanceType] || 0.05) * 24 * days);
  }
  let gb = 0;
  for (const b of Object.values(c.state.s3.buckets)) for (const o of Object.values(b.objects)) for (const v of o.versions) gb += (v.Size || 0) / 1073741824;
  if (gb > 0) add('Amazon Simple Storage Service', '', gb * 0.023 * (days / 30));
  return parts;
}
const ops = {
  'get-cost-and-usage': (c) => {
    const tp = c.reqParam('time-period');
    if (!tp || !DATE.test(tp.Start || '') || !DATE.test(tp.End || '')) c.fail('ValidationException', 'Time period must be in the form Start=YYYY-MM-DD,End=YYYY-MM-DD.');
    if (tp.End <= tp.Start) c.fail('DataUnavailableException', 'End date must be after start date.');
    const gran = c.req('granularity');
    if (!['DAILY', 'MONTHLY'].includes(gran)) c.fail('ValidationException', `Value '${gran}' at 'granularity' failed to satisfy constraint: Member must satisfy enum value set: [HOURLY, DAILY, MONTHLY]`);
    const metrics = c.list('metrics');
    if (!metrics.length) c.req('metrics');
    const groupBy = c.has('group-by') ? c.paramList('group-by')[0] : null;
    const results = periods(tp.Start, tp.End, gran).map(([s, e, days]) => {
      const parts = costs(c, days);
      const metricObj = (amt) => Object.fromEntries(metrics.map((m) => [m, { Amount: money(amt), Unit: 'USD' }]));
      const entry = { TimePeriod: { Start: s, End: e }, Total: {}, Groups: [], Estimated: false };
      if (!groupBy) entry.Total = metricObj(Object.values(parts).reduce((n, p) => n + p.total, 0));
      else if (groupBy.Type === 'DIMENSION') entry.Groups = Object.entries(parts).map(([svc, p]) => ({ Keys: [svc], Metrics: metricObj(p.total) }));
      else entry.Groups = Object.values(Object.values(parts).reduce((acc, p) => { for (const [t, v] of Object.entries(p.tags)) { acc[t] = acc[t] || { Keys: [`${groupBy.Key}$${t}`], total: 0 }; acc[t].total += v; } return acc; }, {})).map((g) => ({ Keys: g.Keys, Metrics: metricObj(g.total) }));
      return entry;
    });
    return { ResultsByTime: results, DimensionValueAttributes: [] };
  },
};
module.exports = { ops };
