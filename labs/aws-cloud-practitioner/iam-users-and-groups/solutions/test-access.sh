aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/dev-alice --action-names s3:PutObject --query 'EvaluationResults[0].EvalDecision' --output text > decision.txt
