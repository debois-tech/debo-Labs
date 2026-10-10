// AWS Support API: on the Basic plan these calls are refused, exactly like the real service.
const refuse = (c) => c.fail('SubscriptionRequiredException', 'AWS Premium Support Subscription is required to use this service.');
module.exports = { ops: { 'describe-trusted-advisor-checks': refuse, 'describe-services': refuse, 'describe-severity-levels': refuse, 'create-case': refuse } };
