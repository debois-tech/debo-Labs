// SNS topics and subscriptions (the usual target of an alarm)
const ops = {
  'create-topic': (c) => {
    const name = c.req('name');
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(name)) c.fail('InvalidParameter', 'Invalid parameter: Topic Name');
    const arn = `arn:aws:sns:${c.region}:${c.account}:${name}`;
    c.state.sns.topics[arn] = { TopicArn: arn };
    return { TopicArn: arn };
  },
  'list-topics': (c) => ({ Topics: Object.values(c.state.sns.topics).filter((t) => t.TopicArn.split(':')[3] === c.region) }),
  'delete-topic': (c) => { delete c.state.sns.topics[c.req('topic-arn')]; },
  subscribe: (c) => {
    const arn = c.req('topic-arn'), proto = c.req('protocol');
    if (!c.state.sns.topics[arn]) c.fail('NotFound', 'Topic does not exist');
    if (!['email', 'email-json', 'sms', 'http', 'https', 'sqs', 'lambda'].includes(proto)) c.fail('InvalidParameter', `Invalid parameter: Amazon SNS does not support this protocol string: ${proto}`);
    c.state.sns.subscriptions.push({ TopicArn: arn, Protocol: proto, Endpoint: c.req('notification-endpoint') });
    return { SubscriptionArn: 'pending confirmation' };
  },
  'list-subscriptions-by-topic': (c) => ({ Subscriptions: c.state.sns.subscriptions.filter((s) => s.TopicArn === c.req('topic-arn')).map((s) => ({ SubscriptionArn: 'PendingConfirmation', Owner: c.account, Protocol: s.Protocol, Endpoint: s.Endpoint, TopicArn: s.TopicArn })) }),
};
module.exports = { ops };
