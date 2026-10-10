// AWS Budgets
const { iso } = require('./core');
const TIME_UNITS = ['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
const accountCheck = (c) => { const a = c.req('account-id'); if (a !== c.account) c.fail('AccessDeniedException', `You are not authorized to access account ${a}.`); };
const ops = {
  'create-budget': (c) => {
    accountCheck(c);
    const b = c.reqParam('budget');
    if (!b || !b.BudgetName) c.fail('InvalidParameterException', 'BudgetName is required.');
    if (!b.BudgetLimit || !(parseFloat(b.BudgetLimit.Amount) > 0) || !b.BudgetLimit.Unit) c.fail('InvalidParameterException', 'BudgetLimit with a positive Amount and a Unit is required for a COST budget.');
    if (!TIME_UNITS.includes(b.TimeUnit)) c.fail('InvalidParameterException', `TimeUnit must be one of ${TIME_UNITS.join(', ')}.`);
    if (!['COST', 'USAGE', 'RI_UTILIZATION', 'RI_COVERAGE', 'SAVINGS_PLANS_UTILIZATION', 'SAVINGS_PLANS_COVERAGE'].includes(b.BudgetType)) c.fail('InvalidParameterException', 'BudgetType is invalid.');
    if (c.state.budgets[b.BudgetName]) c.fail('DuplicateRecordException', 'Error creating budget: ' + b.BudgetName + ' - the budget already exists.');
    c.state.budgets[b.BudgetName] = { ...b, LastUpdatedTime: iso(), notifications: c.has('notifications-with-subscribers') ? c.paramList('notifications-with-subscribers') : [] };
  },
  'describe-budgets': (c) => {
    accountCheck(c);
    return { Budgets: Object.values(c.state.budgets).map(({ notifications, ...b }) => ({ ...b, CalculatedSpend: { ActualSpend: { Amount: '0.0', Unit: b.BudgetLimit.Unit }, ForecastedSpend: { Amount: '0.0', Unit: b.BudgetLimit.Unit } } })) };
  },
  'describe-notifications-for-budget': (c) => {
    accountCheck(c);
    const b = c.state.budgets[c.req('budget-name')];
    if (!b) c.fail('NotFoundException', 'Error describing notifications - budget not found.');
    return { Notifications: b.notifications.map((n) => n.Notification) };
  },
  'delete-budget': (c) => {
    accountCheck(c);
    const n = c.req('budget-name');
    if (!c.state.budgets[n]) c.fail('NotFoundException', `Error deleting budget: ${n} - the budget doesn't exist.`);
    delete c.state.budgets[n];
  },
};
module.exports = { ops };
