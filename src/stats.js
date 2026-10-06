// Live resource stats read from this container's own cgroup v2 files (no
// Kubernetes API access needed). Sampled once on a shared interval rather than per
// request, so many clients polling /stats cost one read, not one each.
const os = require('os');
const { readCgroupCpuUsageUsec, readCgroupCpuLimitCores, readCgroupMemory } = require('./lib');

function createStats() {
  let latest = { cpuPercent: null, memUsedMb: 0, memLimitMb: 0, uptimeSec: 0 };
  let last = { t: Date.now(), u: readCgroupCpuUsageUsec() };

  function sample() {
    const t1 = Date.now();
    const u1 = readCgroupCpuUsageUsec();
    let cpuPercent = null;
    if (last.u !== null && u1 !== null) {
      // Relative to the container's CPU quota when it has one: pegging a 0.5-core
      // limit reads 100%, not 50% of a whole core.
      const cores = readCgroupCpuLimitCores() || 1;
      cpuPercent = Math.max(0, Math.min(100, ((u1 - last.u) / ((t1 - last.t) * 1000 * cores)) * 100));
    }
    last = { t: t1, u: u1 };
    const mem = readCgroupMemory(os.totalmem());
    latest = {
      cpuPercent: cpuPercent === null ? null : Math.round(cpuPercent * 10) / 10,
      memUsedMb: mem ? Math.round(mem.used / 1048576) : Math.round((os.totalmem() - os.freemem()) / 1048576),
      memLimitMb: mem ? Math.round(mem.max / 1048576) : Math.round(os.totalmem() / 1048576),
      uptimeSec: Math.round(process.uptime()),
    };
  }
  sample();
  const timer = setInterval(sample, 2000);
  timer.unref();                     // never keeps a process (or a test run) alive
  return { get: () => latest, stop: () => clearInterval(timer) };
}

module.exports = { createStats };
