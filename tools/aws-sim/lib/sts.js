module.exports = {
  ops: {
    'get-caller-identity': (c) => ({ UserId: 'AIDAEXAMPLELEARNER01', Account: c.account, Arn: `arn:aws:iam::${c.account}:user/learner` }),
  },
};
