// House style for labs, so every lab feels like part of the same product. Pure logic: it runs in unit tests
// (anywhere) and in `validate-labs --strict` (CI). These are conventions, not security checks.
const LIMITS = { title: 48, summary: 100, body: 700, minMinutes: 5, maxMinutes: 20 };

function lintLab(lab) {
  const w = [];
  if (lab.title.length > LIMITS.title) w.push(`title is ${lab.title.length} chars (max ${LIMITS.title})`);
  if (!lab.summary) w.push('summary is missing');
  else if (lab.summary.length > LIMITS.summary) w.push(`summary is ${lab.summary.length} chars (max ${LIMITS.summary})`);
  if (lab.minutes < LIMITS.minMinutes || lab.minutes > LIMITS.maxMinutes) w.push(`minutes is ${lab.minutes} (keep labs ${LIMITS.minMinutes}-${LIMITS.maxMinutes} min)`);
  if (lab.steps[0] && lab.steps[0].type !== 'lesson') w.push('start with a lesson step that frames the idea');
  for (const s of lab.steps) {
    if (s.title.length > LIMITS.title) w.push(`step "${s.id}": title is ${s.title.length} chars (max ${LIMITS.title})`);
    if (s.body.length > LIMITS.body) w.push(`step "${s.id}": body is ${s.body.length} chars (max ${LIMITS.body}) - split it`);
    if (s.type === 'task' && !s.hint) w.push(`step "${s.id}": a task needs a hint`);
  }
  if (!lab.steps.some((s) => s.type === 'task')) w.push('a lab needs at least one graded task');
  return w;
}

module.exports = { lintLab, LIMITS };
